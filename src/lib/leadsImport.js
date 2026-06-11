/**
 * Universal lead-file importer for the Email Campaigns wizard.
 *
 * Auto-detects the format of an uploaded CSV/XLS-as-text export and maps it to
 * the normalized recipient shape the campaign backend expects:
 *   { client_name, email, phone, address, city, state, zip, quote_number,
 *     quote_status, quote_total, quote_count, line_items, line_item_names,
 *     origin, internal }
 *
 * Supported formats:
 *  - Jobber Quotes Report (origin "quote") — delegates to quotesCsv.js
 *  - Angi leads export (origin "inquiry") — "Lead Number"/"Lead Description"
 *  - Generic lead lists (origin "inquiry") — fuzzy header matching; anything
 *    with an email column works
 */
import { parseCsv, parseQuotesReport } from "./quotesCsv.js";

const INTERNAL_DOMAINS = ["thesamiacompanies.com", "coenconstruction.com"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isInternal(email) {
  const domain = email.split("@")[1] || "";
  return INTERNAL_DOMAINS.includes(domain.toLowerCase());
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// Real binary spreadsheets can't be parsed as text — ask for a CSV export.
export function looksBinary(bytes) {
  if (!bytes || bytes.length < 4) return false;
  const [a, b, c, d] = bytes;
  if (a === 0xd0 && b === 0xcf && c === 0x11 && d === 0xe0) return true; // legacy .xls (OLE)
  if (a === 0x50 && b === 0x4b) return true; // .xlsx (zip)
  return false;
}

// Angi task descriptions are long ("Build or Replace a Deck or Non-Masonry
// Porch") — turn them into phrases that read naturally in an email and feed
// the existing segment classifier.
const ANGI_PHRASES = [
  [/gazebo|freestanding porch/i, "gazebo or freestanding porch"],
  [/sunroom|patio enclosure/i, "sunroom or patio enclosure"],
  [/deck|porch/i, "new deck or porch"],
  [/addition/i, "home addition"],
  [/kitchen/i, "kitchen remodel"],
  [/basement/i, "basement remodel"],
  [/bathroom|bathtub|shower/i, "bathroom project"],
  [/siding/i, "siding project"],
  [/roof/i, "roofing project"],
  [/one or more rooms/i, "room remodel"],
  [/renovate or repair a home/i, "home renovation"],
  [/carpentr/i, "carpentry project"],
  [/garage/i, "garage project"],
];

export function friendlyProjectPhrase(description) {
  const desc = String(description || "").trim();
  if (!desc) return "";
  for (const [re, phrase] of ANGI_PHRASES) {
    if (re.test(desc)) return phrase;
  }
  // Fallback: soften the raw task text — "Install or Replace a Water Heater"
  // → "water heater project".
  const cleaned = desc
    .replace(/^(build|install|replace|remodel|renovate|repair|add|or|a|an)(\s+(or\s+)?(build|install|replace|remodel|renovate|repair|add))*\s+/i, "")
    .replace(/^(a|an|the)\s+/i, "")
    .toLowerCase()
    .trim();
  return cleaned ? `${cleaned} project` : desc.toLowerCase();
}

function rowsToObjects(rows) {
  const headers = rows[0].map((h) => String(h || "").trim());
  return {
    headers,
    records: rows.slice(1).filter((r) => r && r.length > 1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = String(r[i] ?? "").trim(); });
      return obj;
    }),
  };
}

// ── Angi leads export ──

function parseAngiLeads(rows) {
  const { records } = rowsToObjects(rows);
  const byEmail = new Map();
  let skippedNoEmail = 0;
  for (const r of records) {
    const email = String(r["Email"] || "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) { skippedNoEmail++; continue; }
    const name = [r["Customer First Name"], r["Customer Last Name"]].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const description = r["Lead Description"] || "";
    const phrase = friendlyProjectPhrase(description);
    const leadNum = Number(r["Lead Number"]) || 0;
    const entry = {
      client_name: name || email,
      email,
      phone: r["Phone"] || "",
      address: r["Customer Address"] || "",
      city: r["City"] || "",
      state: r["State"] || "",
      zip: r["Zip Code"] || "",
      quote_number: String(r["Lead Number"] || ""),
      quote_status: r["Lead Status"] || "",
      quote_total: 0,
      line_items: description,
      line_item_names: phrase ? [phrase] : [],
      origin: "inquiry",
      internal: isInternal(email),
      _ord: leadNum,
    };
    const existing = byEmail.get(email);
    if (!existing) byEmail.set(email, { ...entry, quote_count: 1 });
    else {
      existing.quote_count++;
      if (leadNum > existing._ord) byEmail.set(email, { ...entry, quote_count: existing.quote_count });
    }
  }
  const customers = [...byEmail.values()].map(({ _ord, ...c }) => c);
  return { customers, skippedNoEmail, totalRows: records.length };
}

// ── Generic lead lists: fuzzy header matching ──

const GENERIC_COLUMNS = {
  email: [/^e-?mail/i, /e-?mail/i],
  firstName: [/^first\s*name$/i, /first\s*name/i],
  lastName: [/^last\s*name$/i, /last\s*name/i],
  name: [/^(full\s*)?(client|customer|contact|lead)?\s*name$/i, /\bname\b/i],
  phone: [/^phone/i, /phone|mobile|cell/i],
  address: [/^(street|service\s*street|address)/i, /address|street/i],
  city: [/^city$/i, /city|town/i],
  state: [/^(state|province)/i, /state|province/i],
  zip: [/^zip/i, /zip|postal/i],
  status: [/^(lead\s*)?status$/i, /status|stage/i],
  description: [/description|project|service|task|interest|notes?$|line\s*items|type\s*of\s*work/i],
  reference: [/^(lead|quote|job|ref)\s*(#|number|no|id)/i, /\b(id|number|#)\b/i],
};

function matchColumn(headers, patterns, taken) {
  for (const re of patterns) {
    const idx = headers.findIndex((h, i) => !taken.has(i) && re.test(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseGenericLeads(rows) {
  const { headers, records } = rowsToObjects(rows);
  const taken = new Set();
  const col = {};
  // Email first — it's required and anchors the mapping.
  for (const key of ["email", "firstName", "lastName", "name", "phone", "address", "city", "state", "zip", "status", "description", "reference"]) {
    const idx = matchColumn(headers, GENERIC_COLUMNS[key], taken);
    col[key] = idx === -1 ? null : headers[idx];
    if (idx !== -1) taken.add(idx);
  }
  if (!col.email) throw new Error("Couldn't find an email column in this file. Make sure the export includes customer emails.");

  const mapping = Object.fromEntries(Object.entries(col).filter(([, v]) => v));
  const byEmail = new Map();
  let skippedNoEmail = 0;
  let ord = 0;
  for (const r of records) {
    const email = String(r[col.email] || "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) { skippedNoEmail++; continue; }
    ord++;
    const name = (col.name && r[col.name])
      || [col.firstName && r[col.firstName], col.lastName && r[col.lastName]].filter(Boolean).join(" ");
    const description = col.description ? r[col.description] : "";
    const phrase = friendlyProjectPhrase(description);
    const entry = {
      client_name: String(name || "").replace(/\s+/g, " ").trim() || email,
      email,
      phone: col.phone ? r[col.phone] : "",
      address: col.address ? r[col.address] : "",
      city: col.city ? r[col.city] : "",
      state: col.state ? r[col.state] : "",
      zip: col.zip ? r[col.zip] : "",
      quote_number: col.reference ? String(r[col.reference]) : "",
      quote_status: col.status ? r[col.status] : "",
      quote_total: 0,
      line_items: description,
      line_item_names: phrase ? [phrase] : [],
      origin: "inquiry",
      internal: isInternal(email),
      _ord: ord,
    };
    const existing = byEmail.get(email);
    if (!existing) byEmail.set(email, { ...entry, quote_count: 1 });
    else {
      existing.quote_count++;
      // Later rows win — most exports are oldest-first.
      if (ord > existing._ord) byEmail.set(email, { ...entry, quote_count: existing.quote_count });
    }
  }
  const customers = [...byEmail.values()].map(({ _ord, ...c }) => c);
  return { customers, skippedNoEmail, totalRows: records.length, mapping };
}

// ── Detection ──

export function detectAndParse(text) {
  const clean = stripBom(String(text || ""));
  const rows = parseCsv(clean);
  if (rows.length < 2) throw new Error("The file looks empty — no data rows found.");
  const headers = rows[0].map((h) => String(h || "").trim());

  if (headers.includes("Quote #") && headers.includes("Client email")) {
    const result = parseQuotesReport(clean);
    return {
      format: "jobber",
      formatLabel: "Jobber quotes export",
      customers: result.customers.map((c) => ({ ...c, origin: "quote" })),
      skippedNoEmail: result.skippedNoEmail,
      totalRows: result.totalQuotes,
    };
  }

  if (headers.includes("Lead Number") && headers.includes("Lead Description")) {
    return { format: "angi", formatLabel: "Angi leads export", ...parseAngiLeads(rows) };
  }

  const generic = parseGenericLeads(rows);
  return {
    format: "generic",
    formatLabel: `Lead list (matched: ${Object.entries(generic.mapping).map(([k, v]) => `${k} → "${v}"`).join(", ")})`,
    ...generic,
  };
}
