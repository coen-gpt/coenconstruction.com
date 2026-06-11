/**
 * Parser for the Jobber "Quotes Report" CSV export, used by the Email
 * Campaigns wizard. Groups quotes into one audience entry per customer email,
 * keeping the most recent quote (highest quote #) as the personalization
 * source.
 */

const INTERNAL_DOMAINS = ["thesamiacompanies.com", "coenconstruction.com"];

// RFC-4180 CSV parse: handles quoted fields, embedded commas, "" escapes, and
// embedded newlines.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// "Front Staircase Rebuild (1, $7775.00), Paver Walkway (1, $5200.00)" →
// ["Front Staircase Rebuild", "Paver Walkway"]. Names may themselves contain
// commas, so split on the ")," item boundary rather than plain commas.
export function parseLineItemNames(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/\)\s*,\s*/)
    .map((part) => {
      const m = part.match(/^(.*?)\s*\(\s*[\d.]+\s*,\s*\$[\d,.]+\s*\)?\s*$/);
      return (m ? m[1] : part).trim();
    })
    .filter(Boolean);
}

function isInternal(email) {
  const domain = email.split("@")[1] || "";
  return INTERNAL_DOMAINS.includes(domain.toLowerCase());
}

/**
 * Returns { customers, skippedNoEmail, totalQuotes }.
 * Each customer: { client_name, email, phone, address, city, state, zip,
 *   quote_number, quote_status, quote_total, quote_count, line_items,
 *   line_item_names, internal }
 */
export function parseQuotesReport(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { customers: [], skippedNoEmail: 0, totalQuotes: 0 };
  const headers = rows[0].map((h) => h.trim());
  const idx = (name) => headers.indexOf(name);
  const col = {
    quote: idx("Quote #"),
    name: idx("Client name"),
    email: idx("Client email"),
    phone: idx("Client phone"),
    street: idx("Service street"),
    city: idx("Service city"),
    state: idx("Service province"),
    zip: idx("Service ZIP"),
    status: idx("Status"),
    items: idx("Line items"),
    total: idx("Total ($)"),
  };
  if (col.email === -1) throw new Error('This file doesn\'t look like a Jobber quotes export (no "Client email" column).');

  const byEmail = new Map();
  let skippedNoEmail = 0;
  let totalQuotes = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;
    totalQuotes++;
    const email = String(r[col.email] || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skippedNoEmail++; continue; }
    const quoteNum = Number(r[col.quote]) || 0;
    const entry = {
      client_name: String(r[col.name] || "").replace(/\s+/g, " ").trim(),
      email,
      phone: String(r[col.phone] || "").trim(),
      address: String(r[col.street] || "").trim(),
      city: String(r[col.city] || "").trim(),
      state: String(r[col.state] || "").trim(),
      zip: String(r[col.zip] || "").trim(),
      quote_number: String(quoteNum || r[col.quote] || ""),
      quote_status: String(r[col.status] || "").trim(),
      quote_total: Number(r[col.total]) || 0,
      line_items: String(r[col.items] || "").trim(),
      line_item_names: parseLineItemNames(r[col.items]),
      internal: isInternal(email),
      _quoteNum: quoteNum,
    };
    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, { ...entry, quote_count: 1 });
    } else {
      existing.quote_count++;
      // The newest quote (highest #) wins as the personalization source.
      if (quoteNum > existing._quoteNum) {
        byEmail.set(email, { ...entry, quote_count: existing.quote_count });
      }
    }
  }
  const customers = [...byEmail.values()].map(({ _quoteNum, ...c }) => c);
  return { customers, skippedNoEmail, totalQuotes };
}
