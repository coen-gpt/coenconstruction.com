# Sub Bid Import — Gmail + Drive → Project "Sub Bids"

**Date:** 2026-06-11
**Status:** Approved-by-default (autonomous session; user requested end-to-end delivery)

## Goal

Find original sub/vendor quotes, bids, and estimates in the company mailboxes
(info@coenconstruction.com and cole@coenconstruction.com) and Google Drive,
attach them to the matching **in-progress** ContractorProject's **Sub Bids**
tab, AI-classify the trade, summarize each bid, show totals, and make the
source document viewable.

## What exists today

- `SubBid` entity + `SubBidDashboard` (Sub Bids tab on estimator Project
  Detail) — built for the *invite → vendor portal* flow (status: invited →
  submitted → selected/rejected). `quote_pdf_url` links directly to the
  uploaded file.
- `scanGmailInvoices` — the proven pattern for this exact job: info@ Gmail
  OAuth (SyncState `gmail_oauth` / `GMAIL_REFRESH_TOKEN`), attachment upload
  via `Core.UploadFile`, `InvokeLLM` extraction with `file_urls`,
  deterministic address/name → project matching, SyncState skip-list.
- Vendor directory is effectively empty (test rows only) — trade matching
  must come from AI extraction, not directory lookup.
- MCP access in this session: Gmail (cole@coenconstruction.com), Google
  Drive, Base44 entities. The Gmail MCP cannot download attachment bytes.

## Design

### 1. SubBid schema extension (additive, grafted — no field removed)

New optional fields:

| Field | Type | Purpose |
|---|---|---|
| `source` | enum: `portal`, `gmail_import`, `drive_import`, `manual` | distinguishes imported bids; absent = legacy portal flow |
| `gmail_message_id`, `gmail_thread_id` | string | dedupe + provenance |
| `gmail_link` | string | "Open Email" deep link (mail.google.com) |
| `drive_file_id`, `drive_link` | string | Drive provenance + "Open in Drive" |
| `email_subject`, `email_from`, `email_received_date` | string | display + audit |
| `ai_summary` | string | 1–2 sentence AI summary of the bid |
| `ai_match_confidence` | number 0–100 | project-match confidence |
| `ai_match_reason` | string | why this project was chosen |
| `attachment_urls`, `attachment_names` | arrays | Base44-hosted copies of the quote docs |

Imported bids get `status: "submitted"` (+ `submitted_at` = email date) so the
existing compare/Select-Winner/estimate-update flows work unchanged.

### 2. New function `scanSubBidEmails` (info@ mailbox)

Pattern-copy of `scanGmailInvoices`, with:

- Auth: `verifyAdminSession(req, 'can_access_estimates')`.
- Gmail query: `has:attachment (quote OR bid OR estimate OR proposal) -in:sent`
  (no `to:` filter — PMs forward sub quotes internally; those forwards carry
  the original attachments).
- Skip permanently (SyncState key `gmail_subbid_skips`): no attachment, no
  bid keyword, noise senders (Google Voice, marketing), LLM says
  not-a-sub-bid, or no in-progress project match.
- Attachments uploaded to Base44 storage (first 3) → directly viewable URLs.
- One `InvokeLLM` call per message (with `file_urls`): returns
  `is_sub_bid`, vendor company/contact/email, `trade` (canonical list:
  Electrical, Plumbing, HVAC, Framing, Roofing, Siding, Plastering/Drywall,
  Painting, Flooring, Masonry/Concrete, Windows & Doors, Lumber & Materials,
  Glass & Shower, Sheet Metal, Demolition, Landscaping, Other),
  `bid_amount`, `summary`, and a **project pick from the provided
  in-progress project list** (id + confidence + reason). The deterministic
  address matcher from scanGmailInvoices runs as a cross-check; agreement
  boosts confidence, disagreement defers to the deterministic match.
- Create `SubBid` only when a project matched with confidence ≥ 40;
  dedupe on `gmail_message_id` and on (project, vendor email/company,
  amount) to avoid cross-mailbox duplicates.
- Response: scanned/imported/skipped/remaining counts so the UI can prompt
  to run again.

### 3. SubBidDashboard UI

- **Scan Inbox for Bids** button → invokes `scanSubBidEmails`
  (added to `ADMIN_FUNCTIONS` in `base44Client.js`), toasts the result,
  refetches; shows "N remaining — scan again" when the inbox isn't drained.
- Imported bids render in the existing trade groups with: source badge
  ("📧 Email import" / "📁 Drive import"), AI summary line, low-confidence
  warning chip (< 70) with the match reason, and view buttons for every
  hosted attachment plus "Open Email" / "Open in Drive" links.
- **Totals**: summary bar at top — bid count, combined submitted value, and
  selected-winners total; each trade group header shows its low bid and
  combined value.

### 4. Data population (after deploy)

1. Trigger `scanSubBidEmails` repeatedly (info@ mailbox, hosted attachments).
2. cole@ mailbox: session-side sweep via Gmail MCP — Claude identifies real
   sub-bid threads, extracts amounts from bodies/snippets, creates SubBid
   records via the Base44 MCP with `gmail_link` for viewing (attachment
   bytes aren't reachable from the MCP; the email deep link is the viewer).
3. Drive: session-side sweep via Drive MCP for quote/bid/estimate documents
   tied to active-project addresses; records get `drive_link`
   (webViewLink) as the viewer.
4. Dedupe across all three sources before insert (same project + vendor +
   amount ⇒ keep the copy with hosted attachments).

## Alternatives considered

- **One mega-function that also crawls Drive**: rejected — the backend has no
  Drive OAuth token; adding a second OAuth flow is out of scope when the
  session MCP already has Drive access.
- **Extending InvoiceRecord instead of SubBid**: rejected — invoices are
  payables; bids belong to the existing Sub Bids comparison flow
  (trade grouping, Select Winner → estimate line item).
- **Status `imported` instead of `submitted`**: rejected — would break the
  existing comparison/winner flow and add a status the portal never sets.

## Error handling

- Transient Gmail/LLM failures: message is retried on the next scan (not
  added to skip list) — same as the invoice scanner.
- LLM unavailable: message skipped without a record; nothing is created with
  fabricated amounts.
- Schema graft: live schema fetched first and new fields merged in
  (Base44 `update_entity_schema` replaces the whole schema — clobber hazard).

## Testing

- `npm run build` (no test suite exists for functions).
- Post-deploy: live scan run + spot-check of created records against the
  source emails; UI verified on a project with imported bids.
