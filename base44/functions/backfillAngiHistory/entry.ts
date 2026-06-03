import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PROJECT_TYPE_MAP = {
  "Home Addition": "Home Addition",
  "Kitchen Remodel": "Kitchen Remodel",
  "kitchen_remodel": "Kitchen Remodel",
  "Bathroom Remodel": "Bathroom Remodel",
  "bathroom_remodel": "Bathroom Remodel",
  "Deck / Porch / Pergola": "Deck / Porch / Pergola",
  "deck_porch_pergola": "Deck / Porch / Pergola",
  "Siding": "Siding",
  "siding": "Siding",
  "Custom Carpentry": "Custom Carpentry",
  "custom_carpentry": "Custom Carpentry",
  "Snow Removal": "Snow Removal",
  "snow_removal": "Snow Removal",
  "Full Home Renovation": "Full Home Renovation",
  "full_home_renovation": "Full Home Renovation",
  "Roofing": "Roofing",
  "roofing": "Roofing",
  "Flooring": "Flooring",
  "flooring": "Flooring",
  "General Inquiry": "Other",
  "general_inquiry": "Other",
};

const VALID_PROJECT_TYPES = [
  "Home Addition", "Kitchen Remodel", "Bathroom Remodel", "Deck / Porch / Pergola",
  "Siding", "Custom Carpentry", "Snow Removal", "Full Home Renovation",
  "Roofing", "Flooring", "Other"
];

function parseAddress(address) {
  const str = (address || "").trim();
  if (!str) return { client_address: "", client_city: "", client_zipcode: "" };
  const parts = str.split(",").map(p => p.trim());
  if (parts.length >= 3) {
    const street = parts[0];
    const city = parts[1];
    const stateZip = parts[parts.length - 1].trim();
    const zipMatch = stateZip.match(/(\d{5})/);
    return { client_address: street, client_city: city, client_zipcode: zipMatch ? zipMatch[1] : "" };
  } else if (parts.length === 2) {
    const street = parts[0];
    const stateZip = parts[1].trim();
    const zipMatch = stateZip.match(/(\d{5})/);
    return {
      client_address: street,
      client_city: zipMatch ? stateZip.replace(zipMatch[0], "").replace(/,/g, "").trim() : stateZip,
      client_zipcode: zipMatch ? zipMatch[1] : ""
    };
  }
  return { client_address: str, client_city: "", client_zipcode: "" };
}

function parseLeadDate(lead) {
  if (lead.lead_received_date) return { date: lead.lead_received_date };
  const notes = lead.notes || "";
  const match = notes.match(/Lead date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (match) {
    const month = match[1].padStart(2, "0");
    const day = match[2].padStart(2, "0");
    const year = match[3];
    return { date: `${year}-${month}-${day}` };
  }
  return { date: null };
}

function digitsOnly(str) {
  return (str || "").replace(/\D/g, "");
}

function findMatchingProject(lead, projects) {
  const nameLower = (lead.full_name || "").trim().toLowerCase();
  const emailLower = (lead.email || "").trim().toLowerCase();
  const phoneDigits = digitsOnly(lead.phone);
  const addrLower = (lead.address || "").trim().toLowerCase();

  return projects.find(p => {
    const projNameLower = (p.client_name || "").trim().toLowerCase();
    if (projNameLower !== nameLower) return false;
    if (emailLower && (p.client_email || "").trim().toLowerCase() === emailLower) return true;
    if (phoneDigits && digitsOnly(p.client_phone) === phoneDigits) return true;
    const projAddr = (p.client_address || "").trim().toLowerCase();
    if (projAddr && addrLower && (projAddr === addrLower || addrLower.includes(projAddr) || projAddr.includes(addrLower))) return true;
    return false;
  });
}

// Load only in-scope leads (still need work)
async function loadPendingLeads(base44, batchSize) {
  // We need leads where source=Angi AND is_historical=true AND (no date OR no project).
  // The SDK filter can only do exact matches, so fetch all Angi historical and filter client-side.
  const all = [];
  let skip = 0;
  const limit = 200;
  while (true) {
    const page = await base44.asServiceRole.entities.Lead.filter(
      { source: "Angi", is_historical: true },
      "-created_date",
      limit,
      skip
    );
    all.push(...page);
    if (page.length < limit) break;
    skip += limit;
  }
  // Filter to only those still needing work
  const pending = all.filter(l => !l.lead_received_date || !l.contractor_project_id);
  return { batch: pending.slice(0, batchSize), remaining_after: Math.max(0, pending.length - batchSize) };
}

// Count remaining without loading all (reuse loadPendingLeads with huge batchSize)
async function countRemaining(base44) {
  const { batch, remaining_after } = await loadPendingLeads(base44, 0);
  return batch.length + remaining_after;
}

async function loadAllProjects(base44) {
  const all = [];
  let skip = 0;
  const limit = 200;
  while (true) {
    const page = await base44.asServiceRole.entities.ContractorProject.list("-created_date", limit, skip);
    all.push(...page);
    if (page.length < limit) break;
    skip += limit;
  }
  return all;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let body = {};
    try { body = await req.json(); } catch (_) { /* no body is fine */ }
    const batchSize = Math.max(1, Math.min(200, parseInt(body.batchSize) || 75));

    // Load this batch of pending leads + fresh project list for dedupe
    const [{ batch, remaining_after }, projects] = await Promise.all([
      loadPendingLeads(base44, batchSize),
      loadAllProjects(base44),
    ]);

    const summary = {
      processed_this_batch: 0,
      dates_set: 0,
      projects_created: 0,
      projects_linked_existing: 0,
      errors_count: 0,
      errors: [],
      remaining: 0,
    };

    for (const lead of batch) {
      try {
        summary.processed_this_batch++;

        const updates = {};

        // DATE
        if (!lead.lead_received_date) {
          const { date } = parseLeadDate(lead);
          if (date) {
            updates.lead_received_date = date;
            summary.dates_set++;
          }
        }

        // PROJECT RECORD
        if (!lead.contractor_project_id) {
          const existing = findMatchingProject(lead, projects);
          if (existing) {
            updates.contractor_project_id = existing.id;
            summary.projects_linked_existing++;
          } else {
            const addr = parseAddress(lead.address);
            const projectType = PROJECT_TYPE_MAP[lead.project_type] ||
              (VALID_PROJECT_TYPES.includes(lead.project_type) ? lead.project_type : "Other");
            const receivedDate = updates.lead_received_date || lead.lead_received_date || "unknown";

            const newProject = await base44.asServiceRole.entities.ContractorProject.create({
              client_name: lead.full_name || "",
              client_email: lead.email || "",
              client_phone: lead.phone || "",
              client_address: addr.client_address,
              client_city: addr.client_city,
              client_zipcode: addr.client_zipcode,
              project_type: projectType,
              status: "imported",
              description: lead.angi_task || lead.message || "",
              scope_of_work: lead.angi_task || "",
              internal_notes: `Imported from Angi historical import. Angi lead #${lead.angi_lead_id || "?"} | Lead date: ${receivedDate} | ${lead.notes || ""}`,
              tags: ["Angi", "Imported"],
            });

            // Add to local list so later leads in this batch can dedupe against it
            projects.push(newProject);
            updates.contractor_project_id = newProject.id;
            summary.projects_created++;
          }
        }

        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.Lead.update(lead.id, updates);
        }
      } catch (err) {
        summary.errors_count++;
        if (summary.errors.length < 10) {
          summary.errors.push({
            lead_id: lead.id,
            angi_lead_id: lead.angi_lead_id || null,
            message: err.message,
          });
        }
      }
    }

    // After processing, count how many are still pending (includes any that errored + weren't updated)
    // remaining_after is the count beyond the batch we took; plus any in our batch that still need work
    // Re-count fresh to be accurate
    const { batch: stillPending } = await loadPendingLeads(base44, 99999);
    summary.remaining = stillPending.length;

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});