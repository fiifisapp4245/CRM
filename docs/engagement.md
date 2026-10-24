# Engagement, Service and Files (Phase 3)

Tasks & Calls, Calendar, Messaging, Campaigns, Tickets and Documents share one data layer. A contact has a single history: one `Activity` record shows up in Tasks & Calls, on the calendar, on the contact and deal timelines, and in the activity feed.

## Shared model

| Record | Where it lives | Notes |
| --- | --- | --- |
| `Activity` (`features/activities/types`) | `db.activities` | Planned items have `status` + `dueAt` (`endAt`, priority, reminder, recurrence, location, attendees). Logged items have `occurredAt` and no status. `contactId` may be null (internal work). SMS/WhatsApp are `type: "message"` + `channel`; `activityKind()` gives the 8 reference kinds. |
| `Communication` (`features/messaging/types`) | `db.communications` | Every outgoing message: channel, kind (one-to-one/campaign), status history, cost (SMS only, else null → "—"), consent snapshot, `mode: "demo"`. One-to-one messages link to the timeline `activityId`; ticket replies link `ticketId`; campaign messages link `campaignId`. |
| `MessageTemplate` | `db.templates` | Variables limited to fields the CRM can fill: first name, full name, company, deal. |
| `Campaign` | `db.campaigns` | Segment + channel + message; eligibility snapshot when scheduled/sent. |
| `Ticket`, `SavedAnswer` (`features/tickets/types`) | `db.tickets`, `db.savedAnswers` | Independent first-response and resolution targets; entries distinguish customer messages, simulated replies, internal notes and events. |
| `Folder`, `DocumentFile` (`features/documents/types`) | `db.folders`, `db.documents` | Bytes in IndexedDB (`lib/storage/file-store.ts`); `links[]` to contacts, accounts, deals, quotes, tickets. |
| `BusinessSettings` (`lib/business/settings.ts`) | `db.settings` | Plan, timezone, business hours, reminder default, SMS reminders, quota, retention, ticket targets, SMS demo rate. |

DB version 6. Upgrading a v5 browser keeps all Phase 1 and Phase 2 data and replaces only the old ticket and document stubs.

## Plans (entitlements)

One module, `lib/entitlements`, decides what a plan includes, and roles stay in `lib/permissions`. Services call `requireFeature`, so the check can't be bypassed from any route or button.

**Current prototype setting:** every module is open. The organisation's plan in `db.settings.plan` is Premium; the DB v7 upgrade sets this for existing browsers. Plan tags, read-only banners and the Demo preview switch were removed from the UI at the product owner's request.

The audited reference account was **Basic**, where Messaging and Tickets were marked Advance and Campaigns Premium. Setting `settings.plan` back to `"basic"` brings back the read-only behaviour and the upgrade dialogs (`components/entitlements/upgrade.tsx`).

## Reference fidelity

**Observed in the reference, and reproduced:**
- Page titles and descriptions.
- Tasks & Calls: the Late / Today / Coming up / No date / Done / Team views; the Whose and Kind filters; the Plan an activity and Log a call forms with their fields, reminder options (business default 15 minutes), "Plan it" / "Log it", and the import modes and limits.
- Calendar: Week and Month views, Previous / Today / Next, the owner filter, click a slot to plan, and the calendar form fields.
- Messaging: the Sent and Templates tabs, summary metrics and filters, the empty-state guidance, and New template marked Advance.
- Campaigns: the statuses, the Premium dialog with "Not now" and "Upgrade to Premium", and the status filter.
- Tickets: views, filters, the Advance dialog, and the dashboard metrics and breakdowns.
- Documents: sections, Upload and New folder (name and the 7 colours), sort options, type categories, Grid and List, the recycle-bin wording and 30 days, and the observed 20 GB quota.

**Prototype enhancements (not verified in the reference):**
- Activities: the detail panel, completing a repeating item creates the next one, Team workload table, deleting with confirmation, and the import preview splitting history from to-dos.
- Calendar: drag-to-reschedule with Undo, and side-by-side lanes for overlapping events.
- Messaging: the message detail drawer and a simulated status history.
- Campaigns: the whole editor workflow (audience eligibility, scheduling within business hours, demo send, results), because the real editor was gated.
- Tickets: the ticket workspace, internal notes, saved-answer insertion, the demo rating, and the reply/resolve targets per priority.
- Documents: preview, links to CRM records, and the record "Files" panels.

**Unverified in the reference:**
- The real recurrence engine.
- Whether reminders are delivered, and through which channel.
- Messaging and Campaigns on paid plans.
- The template editor.
- The real ticket SLA rules, statuses beyond the views, and the rating mechanism.
- Whether binned files count toward the storage quota.
- Folder colour editing after creation.
- Whether a Basic account can send messages from a contact.

**Simulated:**
- All sending and delivery: one-to-one messages, ticket replies and campaign sends.
- Message costs (demo rate of GHS 0.05 per SMS part).
- Customer ratings.
- Upgrades (billing isn't included).
- Reminders, which are in-app only.
- Scheduled campaigns and bin purging, which only run when the app is open.
- File storage, which is in this browser only.

## Prototype rules (confirm with the business)

1. **Logged vs planned:** history is never mixed up with to-dos. A note is always history. "Already happened" can't have a future date.
2. **Views use business time** (Africa/Accra). Late = an open item due before today. Today = due today, including items earlier today, which are also marked Overdue. Coming up = due after today. No date = open with no date. Done = completed or logged.
3. **Repeats:** completing a repeating item records it as done and plans the next occurrence at the same time. Monthly repeats are clamped to the end of the month.
4. **Campaign eligibility:** the campaign goes to the whole organisation's matching contacts. Each person needs an explicit "agreed" marketing record for the channel and a usable address. Declined or withdrawn = opted out; no record = no permission. Send times must fall inside business hours (Mon–Fri 08:00–17:00). A time outside them is never moved automatically: the conflict is explained and a valid alternative offered.
5. **Ticket targets** (calendar hours from opening): Urgent 1 h / 8 h; High 4 h / 24 h; Normal 8 h / 72 h; Low 24 h / 120 h (first reply / resolve). Changing priority recalculates both targets. Reopening keeps the original resolution target. The first reply sets the first-response time.
6. **Ticket access:** anyone who can see the customer can see the ticket. Changing it needs `tickets.manage` plus owner scope (own and unassigned / team / all).
7. **Documents** are shared across the organisation. Binned items count toward storage until they're deleted for good. Binning a folder bins everything inside it, and restoring it brings everything back. An item whose parent folder is gone is restored to My documents.
8. **Same-name colleagues** are told apart by their email in pickers, never guessed.
