# Module progress

## Completed (Phase 1)

| Area | Notes |
| --- | --- |
| Application shell | Collapsible persisted sidebar, grouped nav with active state, mobile drawer, ⌘K global search (contacts, actions, pages), notifications, profile + role switcher, reset demo data, skip link, breadcrumbs. |
| Roles and permissions | Central matrix, record scopes, org boundary, `<Can>`/`usePermission`, service-level checks. |
| Mock data and persistence | Deterministic fictional seed (~130 contacts, 2 orgs), localStorage persistence, versioned reset. |
| Contacts list | Search (name, email, normalised phone, company), owner/source/status/tag filters with chips, sort, built-in and saved views, pagination, bulk select, bulk reassign/archive/restore, row actions, CSV export, duplicate banner, loading/empty states. |
| Create / edit contact | Shared RHF + Zod form, sections + "More details", multiple methods with labels and primary, WhatsApp shortcut, live and on-submit duplicate warning, unsaved-change guard, validation, permission-aware owner field. |
| Contact workspace | Header actions, up-next tasks/meetings with completion + undo, composer (note, call, task, meeting), interaction timeline with filters, change history, contact details with copy, consent panel + history, about, prototype deals/tickets/files, send message with consent gate, archive/restore, change owner. |
| Import | CSV + XLSX, limits, template, sample file, mapping incl. custom fields, validation, duplicate handling, confirm, results, problem-row report, history. |
| Duplicates | Detection by normalised email/phone, side-by-side groups, dismiss, merge with field resolution, preview, consent-conflict warning, audit. |
| Dashboard foundation | Role-specific layouts (see audit-findings.md). |
| Activity feed (`/activity`) | Categories (Everything, Sales, Customers, Tasks & Calls, Service, Messaging, Settings), search, people filter, date ranges (default 30 days, custom range, "Show older"), day grouping, detail sheet with readable field changes, separate technical details, permission-aware. |
| Accounts | List with owner/type/rating/size/structure filters, sectioned form with progressive disclosure, parent picker with cycle prevention, head-office/branch hierarchy tree, account workspace (contacts, structure, interactions, deals, history), shared-pattern import with number→name matching, ambiguous-name flagging and visible auto-created parents. |
| Segments | List with live counts and visibility; builder with Add condition, explicit AND/OR rules, live count and audience preview, private/shared, edit/delete, read-only view for others. |

| Sales (Phase 2) | Leads (list, workspace, scoring, conversion), Pipeline board (drag-and-drop + keyboard Move menu, explicit Won/Lost), Deals (list with drill-downs, manual or product valuation, workspace, won/lost/reopen, attention states, import), Quotes (editor, preview, simulated lifecycle and customer view), Products (catalogue, MyStoreGuard lock, simulated sync), Forecast (three-question KPIs, six-month chart with table view, breakdowns with drill-downs, per-currency). See `docs/sales.md`. |

| Engagement, Service, Files (Phase 3) | Tasks & Calls (views, filters, plan/log forms, Log a call, details, done/reopen/delete, repeats, import), Calendar (week/month, click-to-plan, drag-to-reschedule with Undo), Messaging (sent history, filters, detail, templates, send from contact/deal), Campaigns (eligibility, business-hours scheduling, demo send, results, stop), Tickets (views, workspace, replies/notes, saved answers, targets, dashboard), Documents (folders, upload, preview, star, move, link, recycle bin, storage). Plan gating for Advance/Premium. See `docs/engagement.md`. |

| Guide | Searchable in-app how-tos grouped like the sidebar, each linking to its page. |

## In progress

None.

## Pending (route placeholders only, awaiting UX audit)

Reports, Settings.

**Next planned:** to be set after the next audit (Engagement, Service, Files, Insight and System remain).

## Known limitations

- All data is per-browser localStorage; nothing is shared between people or devices.
- No authentication; the role switcher stands in for sign-in.
- Messages are not sent — they're recorded on the timeline.
- Messages, ticket replies, campaign sends, delivery statuses, costs, reminders and ratings are simulated (see `docs/engagement.md`).
- Uploaded file contents are stored in this browser only (IndexedDB); seeded documents have no file content.
- Scheduled campaigns and recycle-bin purging run when the app is opened, not in the background.
- Calendar drag-and-drop needs a pointer; keyboard users reschedule through Edit.
- Quotes, the customer link, payments and MyStoreGuard sync are simulated (see `docs/sales.md`).
- Only one pipeline is shown; the model supports several.
- The pipeline board scrolls horizontally on small screens; the Deals list is the better view on phones.
- Accounts have no archive/delete or export UI (not in the audited capabilities).
- Segment conditions are a fixed AND of conditions; no nested groups.
- Activity feed reads the prototype audit trail; deals, tickets and settings events are seeded demo data.
- Contacts table scrolls horizontally on phones; a card layout for small screens is a candidate improvement.
- Table sorting is via the Sort menu only (no clickable column headers) to keep one sorting model aligned with the audit.
- Export isn't written to the audit log (audit events are per contact).
- XLSX import reads the first sheet only; dates in XLSX are converted to `YYYY-MM-DD`.
- Large imports (10,000 rows) are processed in the browser main thread; fine for the prototype, would move server-side.
- Dark mode is not designed.
- ESLint reports one warning: TanStack Table's `useReactTable` is skipped by the React Compiler (`react-hooks/incompatible-library`). Expected and harmless.
