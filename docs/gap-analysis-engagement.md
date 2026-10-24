# Gap analysis — Phase 3: Engagement, Service and Files

Inspected: the six placeholder routes, `features/activities` (type, service, composer, timeline, up-next), the send-message dialog, consent rules (`contacts/lib/consent.ts`), segments matching, `lib/types/related.ts` (TicketRef, DocumentRef stubs), seed, migration, permissions, nav config and the user menu.

| Area | Current prototype | Gap | Plan |
| --- | --- | --- | --- |
| Routes | `/activities`, `/calendar`, `/messaging`, `/campaigns`, `/tickets`, `/documents` are placeholders | Everything | Build all six on the shared model |
| Activity model | Contact-bound note/call/meeting/task/email/message; tasks have `dueAt` + `status`; logs have `occurredAt` | Visits, priority, end time, reminder, recurrence, location, attendees, account, contact-less tasks, edit/delete | Extend `Activity` (optional fields, `contactId` nullable). Keep `message` + `channel` and derive the SMS/WhatsApp *kind* so the timeline, feed and composer keep working |
| Messages | One-to-one messages exist only as timeline activities | No delivery record, status, cost, templates | New `Communication` (linked to the activity it logs, or to a campaign) and `MessageTemplate` |
| Campaigns | None | Everything | `Campaign` built on Segments + consent eligibility; demo lifecycle |
| Tickets | `TicketRef` stub shown read-only on contacts | Real model, targets, timeline, saved answers, dashboard | `Ticket` with response/resolution targets and entries; `SavedAnswer` |
| Documents | `DocumentRef` stub on contacts | Folders, upload, bin, quota, links | `Folder` + `DocumentFile` with record links; file bytes in IndexedDB |
| Plans | None — every feature is available | Messaging/Tickets need Advance, Campaigns Premium; Basic is read-only | One entitlement module (`lib/entitlements`) used by pages, buttons and services; a clearly labelled "Demo preview" plan switch in the profile menu, defaulting to the audited Basic plan |
| Business settings | None | Timezone, business hours, default reminder, SMS reminders, quota, retention, ticket targets | `Db.settings` (prototype values, labelled) |
| Persistence | Versioned localStorage, v4→v5 migration | Must keep user data | v5→v6 migration keeps everything and replaces only the ticket/document stubs |
