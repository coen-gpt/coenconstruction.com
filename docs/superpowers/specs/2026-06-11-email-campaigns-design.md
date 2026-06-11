# Email Campaigns — Design

Date: 2026-06-11
Source request: Build an admin Email Campaign feature seeded from a Jobber past-quotes
CSV export (2,551 quotes / 1,583 unique customers). Personalize each email around the
customer's quote line items, mass-broadcast, track opens/clicks/engagement, let
recipients schedule a walkthrough or explore the new website, support nudging
non-engaged recipients, and convert walkthrough requests into real Leads with the
standard walkthrough-booking calendar flow.

## Architecture

### Entities (repo jsonc — canonical per the schema-clobber rule)

**EmailCampaign** — one row per campaign.
`name`, `status` (draft|sending|sent), `hero_image_url`, `custom_note`,
`created_by`, `sent_at`, `recipient_count`, `sent_count`, `failed_count`,
`last_nudge_at`. Admin-only RLS.

**CampaignRecipient** — one row per customer per campaign.
Identity: `campaign_id`, `client_name`, `first_name`, `email`, `phone`, `address`,
`city`, `state`, `zip`.
Quote context: `quote_number`, `quote_status`, `quote_total`, `quote_count`,
`line_items` (raw), `line_item_names` (array), `segment`, `project_type`
(mapped to the Lead enum).
Delivery: `send_status` (pending|sent|failed|skipped), `sent_at`, `failed_reason`.
Engagement: `opened_at`, `open_count`, `clicked_at`, `click_count`,
`walkthrough_requested_at`, `unsubscribed` (bool), `unsubscribed_at`,
`last_engaged_at`, `nudge_count`, `last_nudged_at`, `lead_id`. Admin-only RLS.

**Lead** — add `"Email Campaign"` to the `source` enum.

### Backend functions (self-contained, Deno)

**emailCampaigns** (admin; inline 3-part-JWT `verifyAdminSession`, same as
sendBrandedEmail / adminAuth). Actions:
- `create_campaign` — name, hero override, custom note.
- `add_recipients` — chunked rows from the frontend (frontend dedupes by email);
  server classifies segment + project_type from line-item keywords and bulk-creates.
- `list_campaigns`, `get_campaign`, `list_recipients` (paged).
- `preview` — render the full branded HTML for one recipient (or a sample row).
- `send` — sends the next batch (default 20) of `pending` recipients via Resend
  (with List-Unsubscribe header), marks sent/failed, flips campaign to
  sending/sent. Frontend loops until `remaining === 0` (avoids function timeouts).
- `nudge` — frontend passes explicit `recipient_ids` (computed from engagement
  filters client-side); sends a shorter reminder variant, bumps `nudge_count`.
- `delete_campaign` — campaign + its recipients.

**campaignTrack** (public GET at `/api/functions/campaignTrack`).
Token = HMAC-SHA256 over `recipientId|campaignId` with `"campaign:"` context using
`MAGIC_LINK_SECRET || ADMIN_SESSION_SECRET` (same scheme as magic links). Actions:
- `a=o` — record open (first + count), return 1×1 GIF. Always returns the GIF.
- `a=c&d=<key>` — record click, 302 to a whitelisted destination
  (site/services/gallery/financing/portfolio) on coenconstruction.com. No open
  redirect.
- `a=w` — record walkthrough request; idempotently create a **Lead**
  (source "Email Campaign", message includes quote # + line items, pre-generated
  `booking_token`) — Lead creation fires the existing `sendLeadNotification`
  automation (team alert, welcome email, booking email) exactly like any other
  lead — then 302 straight to `/book-walkthrough?token=…` so the customer lands
  on the live slot picker; `confirmBooking` puts the walkthrough on the shared
  Google Calendar as usual.
- `a=u` — unsubscribe; mark recipient, show a plain confirmation page.

### Email content

Branded 600px table layout matching sendBrandedEmail / scheduleLeadWalkthrough
(navy #1B2B3A header/footer, brand-orange CTAs from CompanyProfile.brand_color).
Hero image resolved from CMS `home_hero.bg_image` (fallback to the site default).
Personalization is deterministic (no per-recipient AI):
- Intro references the customer's actual line-item names and town.
- Status-aware framing: open quotes ("your quote is ready when you are"),
  archived ("still thinking about …"), converted/approved ("thank you — here's
  what's new + we're here for the next project").
- Segment-specific seasonal hook (deck, roofing, siding, kitchen, bath,
  addition, repairs, general).
- "What's new at Coen Construction" block: customer portal with live project
  tracking, virtual site walks, online walkthrough booking, financing.
- CTAs: **Schedule a Free Walkthrough** (a=w) + **See What's New** (a=c).
- Footer: contact info + unsubscribe link; List-Unsubscribe header set.
No pricing in the email (totals stay internal).

### Frontend

`/admin/email-campaigns` inside BackendLayout (nav: Sales & Clients, perm
`can_access_leads`; route in App.jsx; function name added to ADMIN_FUNCTIONS).
- `src/lib/quotesCsv.js` — RFC-4180 CSV parser + Jobber-row mapper: groups by
  email (keeps the most recent quote as primary), parses the
  `Name (qty, $price)` line-item format, flags internal domains.
- Page: campaign list → New Campaign wizard (upload CSV → audience summary with
  quote-status include toggles + internal-email exclusion → custom note → create
  + chunked upload with progress) → campaign detail (stat cards: recipients,
  sent, opened, clicked, walkthroughs, unsubscribed; recipient table with
  engagement badges, search, filters; per-recipient HTML preview in an iframe;
  Send loop with progress; Nudge dialog for didn't-open / didn't-click cohorts).

## Error handling
- Send batches mark per-recipient `failed` with the Resend error; campaign keeps
  going. Tracking endpoints never 500 to the customer (pixel always returns the
  GIF; redirects fall back to the homepage).
- Unsubscribed recipients are skipped at send/nudge time.

## Testing
- `npm run build` for the frontend; manual smoke of CSV parsing against the real
  export; preview rendering exercised through the wizard's sample preview.
