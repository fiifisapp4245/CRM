# Implementation log

## Phase 1 — Foundation, shell and Contacts (2026-10-21)

**Inspection**
- Started from an empty workspace (no existing repository). Checked the local MyStoreGuard prototype — its orange primary is MyStoreGuard's own brand, so it wasn't reused.
- Read the reference CRM's public assets (no sign-in, no data access): default accent is the Tailwind cyan scale, favicon `#0891b2`, font Inter. Used as **provisional** brand tokens.

**Foundation**
- Scaffolded Next.js 16 / React 19 / TypeScript / Tailwind v4; shadcn/ui on the Radix base.
- Removed the shadcn CLI as a runtime dependency (it pulled conflicting peer deps); its Tailwind variants were copied to `src/styles/shadcn-variants.css`.
- Pinned TanStack Table to v8 and `@hookform/resolvers` to v5 (v6 has conflicting optional peers).
- Tokens in `src/styles/tokens.css`; control height raised to 36 px for touch.
- Central permissions (`lib/permissions/config.ts`), demo personas, session store, role switcher.
- Persisted Zustand db with deterministic seed and `DB_VERSION`.

**Contacts**
- Pure logic modules with Vitest coverage (39 tests): normalisation, CSV, permissions, form schema, duplicates, merge, import planning/applying, consent rules, filters/visibility, export.
- List, form, workspace, consent, import wizard, duplicates/merge, export.

**Validation**
- Browser-verified: create (with duplicate prompt), edit (phone-only prefill), add/remove methods, search by phone in other format, source filter + chips, bulk reassign, archive/restore, record consent (methods adapt to decision), note + task, sample CSV import, CSV export (intercepted, 12 rows), merge with consent conflict, merged-record redirect, marketing message blocked after an SMS withdrawal, persistence across full reloads, Viewer restrictions, manager/viewer dashboards, phone-width layout.
- Fixed during testing: duplicated note text in the timeline; topbar and grid overflow on phones; readable labels in consent buttons and audit diffs; doubled merge toast; React Compiler lint findings (state reset moved from effects to remount-on-open; `Date.now()` moved to `useNow`; refs replaced with state).
- `npm run build`, `npm run typecheck`, `npm test` pass; lint passes with one expected TanStack warning.

## Phase 1.1 — Visual refinement (2026-10-21)

Feedback: buttons should be rounded, and the UI should feel refined and pleasant rather than resemble the existing CRM. Benchmarks agreed: Stripe Dashboard, Notion/Superhuman, HubSpot/Pipedrive. Cyan kept, balanced density.

- New token set ("Calm workspace"): tinted canvas, panel and card surfaces; ink-tinted shadows; softer status colours; avatar identity tints.
- Typeface changed from Inter to Figtree.
- Pill buttons throughout (`components/ui/button.tsx`), plus pill views, filters, chips, search and sort; softer fields, overlays and dialogs.
- Sidebar redesigned as a tinted panel with a workspace badge and lifted active pill; translucent top bar.
- Contact profile header moved onto the canvas; lighter card headers; dashboard stats joined into one strip.
- Contacts table: combined "Reach" column; status shown inline only when not active; dark floating bulk-action bar.
- Checked at 1440 px and 375 px; `tsc`, tests (39), lint (1 known TanStack warning), the Impeccable design detector and `next build` all pass.

## Phase 2 — UX refinement: Activities, Contacts, Accounts, Segments (2026-10-22)

Spec: restrained enterprise look with IBM Plex Sans and far fewer shadows; refine Activities, Contacts, Accounts and Segments in that order; shared components; genuine interactivity. Gap analysis: `docs/gap-analysis-phase-2.md`.

**Design consistency**
- IBM Plex Sans everywhere via `next/font/google`; body 14 px.
- Resting shadows removed through tokens (`--shadow-xs/sm/primary: none`); active states use hairline rings; only floating layers keep `--shadow-md`.
- New shared pieces: `SearchField`, `FilterChips`, `Segmented`, `MultiSelect`, `AccountSelect`, `ImportWizard`.

**Activity feed** — new `features/activity-feed`; permission-aware event builder; readable field labels; detail sheet; date ranges; nav renamed.

**Contacts** — form re-sectioned (Basic information · Contact methods · Organisation and ownership · Additional details · Consent and notes); optional consent capture on create writes separate consent records, nothing preselected; edit shows status read-only with a link to the profile workflow; "Declined" renamed "Refused"; workspace tabs Activity · Deals · Messages · Tickets · Files · History; header shows primary phone/email and links the account; `?accountId=` prefill; import moved onto the shared wizard.

**Accounts** — full module (data model, seed with head offices/branches and a same-name pair, list, form, workspace, hierarchy, import).

**Segments** — full module (matching engine, list, builder, preview, private/shared).

**Data** — `DB_VERSION` 4 (browsers reseed automatically); audit events extended to accounts, segments, deals, tickets and settings; sync events with raw field keys seeded.

**Validation**
- `tsc`, ESLint (1 known TanStack warning), Vitest **61 tests** (accounts, segments and feed suites added), Impeccable detector (no findings), `next build` (29 routes).
- Browser: feed categories, counts and sync-event detail; segment edit (count 10 → 94 → 11), incomplete-condition block, save; account list, structure tree, parent picker excluding self/branches; account sample import (ambiguous name rejected, parent auto-created, branches linked); contact form sections, consent capture and account prefill; phone width on feed, segment builder and account page.
- Fixed during testing: in-file parent referenced by account number; unstable store selector in the account form causing a render loop.

## Phase 2.1 — Shell and dashboard tweaks (2026-10-22)

- Main content area is white; sidebar and top bar are grey and separated from it by a 1 px stroke.
- Dashboard metrics are separate cards again.
- Removed "Prototype data" tags (dashboard and contact Deals/Tickets/Files tabs) and the "Deal counts only" note.

## Phase 2.2 — Corner radius (2026-10-22)

- Buttons are no longer pills: one 10 px radius (`rounded-lg`) across buttons, search, selects, the account menu and view switchers; chips and status labels use 8 px. Colours unchanged.

## Phase 2.3 — Profile banner and one tab style (2026-10-22)

- Contact page header is now a profile banner card: tinted cover, overlapping avatar, actions, identity, and a facts row (phone, email, owner, last activity).
- One tab style across the app, taken from the contact list views. Replaced underline tabs (contact page, account page, activity composer) and chip toggles (timeline filters, import row filters). Shared classes live in `components/ui/tabs.tsx`.

## Phase 2.4 — Account banner (2026-10-22)

- Profile banner extracted into a shared `ProfileBanner`; account pages now use it (building mark, type/rating, head office/branch line, facts: account number, phone, owner, last updated). Contact page moved onto the same component.

## Phase 2.5 — Timeline grouping (2026-10-22)

- Timeline filter and entries are one outlined section with a header ("Timeline", "Messages", "Interactions"); the filter only appears when there is activity, and "All" no longer shows a count. Next.js dev badge hidden; sidebar Collapse has its own outlined footer; record tabs hide zero counts.

## Phase 3 — Sales experience (2026-10-22)

- Gap analysis in `docs/gap-analysis-sales.md`. Real sales model replaces the read-only `DealRef` stubs; DB v5 with an in-place v4→v5 migration that keeps user data.
- Leads: list, form, workspace, transparent prototype score, auto-assign, disqualify with reason, conversion to contact/company/deal.
- Deals: list with drill-down filters, form with manual or product valuation and line-item editor, workspace (stage steps, attention, line items, deal activity, quotes, history), explicit Mark won / Mark lost dialog, reopen.
- Pipeline board: drag-and-drop between open stages, keyboard Move menu, Won/Lost drop zones that open the outcome dialog, per-currency column totals, live announcements.
- Products catalogue with MyStoreGuard ownership lock and simulated sync. Quotes: editor, preview, lifecycle, simulated customer page; accepting never closes the deal.
- Forecast: period/scope/currency controls, three-question KPIs, secondary indicators, six-month chart (validated teal/amber palette, tooltip, table view), drill-down breakdowns.
- Deal import via the shared wizard with explicit related-record creation; sample `public/samples/deals-sample.csv` exercises every outcome.
- Contact and account Deals tabs, dashboard pipeline panel, activity feed and merge now use real deals. Tests: calculations, forecast, deal import, migration (81 total).

## Phase 4 — Engagement, Service and Files (2026-10-23)

- Gap analysis in `docs/gap-analysis-engagement.md`. DB v6 with a v5→v6 migration that keeps all customer and sales data.
- One plan-entitlement mechanism (Basic default, Demo preview switch) separate from roles; upgrade dialog shared by every restricted action.
- Activity model extended (visits, priority, end time, reminder, recurrence, location, attendees, contact-less work). Tasks & Calls with six views, Whose/Kind filters, Plan/Log forms, Log a call, details panel, done/reopen/delete, repeats, and a preview-first import that never creates contacts.
- Calendar week/month on the same activities, in business time; click-to-plan, drag-to-reschedule with Undo, overlap lanes.
- Messaging history with summary, filters and simulated status history; templates with resolvable fields only; send from contact and deal behind Advance.
- Campaigns (Premium): segment eligibility with exclusion reasons, business-hours scheduling with suggested alternatives, confirmed demo send in batches, stop, results feeding Messaging.
- Tickets (Advance): views from ticket state, workspace with simulated replies and internal notes, saved answers, independent reply/resolve targets, dashboard with "no data" distinct from zero.
- Documents: folders with colours, uploads to IndexedDB with a queue, preview/download, star, rename, move, record links, recycle bin with 30-day retention, storage usage. Contact, deal and ticket pages show linked files.
- Tests: 97 (16 new for Phase 3 rules, import and seed/migration).

## Phase 4.1 — Open modules and messaging filters (2026-10-23)

- Removed Advance/Premium tags, read-only plan banners and the Demo preview switch; every module is open (settings.plan = Premium, DB v7 upgrade). The entitlement check remains in services.
- Messaging: one filter toolbar (search, Channel and Status multi-select with counts, Kind, Sent date range with presets), removable filter chips, result count, a single summary strip, channel and kind combined in the table, related record under the message.
- Campaigns: search and channel filter alongside status; delivery shown as count and rate. Campaign workspace sections no longer numbered.
- Templates show fields as readable tokens.
- New shared filter controls: `DateRangeFilter`, `FilterSelect`.

## Phase 4.2 — Page forms and calendar cards (2026-10-23)

- Creating and editing a product, message template or saved answer now happens on a full page laid out like the deal form (breadcrumbs, form sections, sticky save bar, unsaved-changes guard): `/products/new`, `/products/[id]`, `/messaging/templates/new`, `/messaging/templates/[id]`, `/tickets/answers`, `/tickets/answers/new`, `/tickets/answers/[id]`. The product drawer and the template/saved-answer dialogs were removed. The reference "Plan an activity" modal stays a modal.
- Calendar cards: the coloured left stroke is replaced by a tinted card with a matching 1px border and a type icon (plus a legend). Cards show time range, subject, customer/deal, place and owner as height allows, with done/overdue/high/repeat markers; hovering or focusing a card shows all details.

## Phase 4.3 — Guide, products toolbar, final report (2026-10-23)

- In-app Guide (`/guide`): searchable how-tos for every module.
- Products toolbar: Source is a dropdown (with counts) and a searchable Category filter was added, so the bar no longer stretches as the catalogue grows.
- Final report in `docs/report.md`.
- Campaigns toolbar: status tabs replaced by a Status dropdown with counts, next to search and Channel, plus Clear filters.
