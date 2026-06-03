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
    return { client_address: street, client_city: zipMatch ? stateZip.replace(zipMatch[0], "").replace(/,/g, "").trim() : stateZip, client_zipcode: zipMatch ? zipMatch[1] : "" };
  }
  return { client_address: str, client_city: "", client_zipcode: "" };
}

function parseLeadDate(lead) {
  if (lead.lead_received_date) return { date: lead.lead_received_date, parsed: false };
  const notes = lead.notes || "";
  const match = notes.match(/Lead date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (match) {
    const month = match[1].padStart(2, "0");
    const day = match[2].padStart(2, "0");
    const year = match[3];
    return { date: `${year}-${month}-${day}`, parsed: true };
  }
  return { date: null, parsed: false };
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

async function loadAllLeads(base44) {
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
  return all;
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

    // No auth gate — anyone who can reach this function may run the idempotent backfill
    const [leads, projects] = await Promise.all([
      loadAllLeads(base44),
      loadAllProjects(base44),
    ]);

    const summary = {
      leads_processed: 0,
      dates_set: 0,
      date_unparsed: 0,
      projects_created: 0,
      projects_linked_existing: 0,
      already_done: 0,
    };

    for (const lead of leads) {
      summary.leads_processed++;

      const alreadyHasDate = !!lead.lead_received_date;
      const alreadyHasProject = !!lead.contractor_project_id;

      if (alreadyHasDate && alreadyHasProject) {
        summary.already_done++;
        continue;
      }

      const updates = {};

      // DATE
      if (!alreadyHasDate) {
        const { date } = parseLeadDate(lead);
        if (date) {
          updates.lead_received_date = date;
          summary.dates_set++;
        } else {
          summary.date_unparsed++;
        }
      }

      // PROJECT RECORD
      if (!alreadyHasProject) {
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

          projects.push(newProject);
          updates.contractor_project_id = newProject.id;
          summary.projects_created++;
        }
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Lead.update(lead.id, updates);
      }
    }

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});