# Gap analysis — UX refinement spec (Phase 2)

Inspected: routes in `src/app/(crm)`, shared components (`components/*`), tokens (`styles/tokens.css`), data model and stores (`lib/mock-data`, `features/*/types`), services and permission config. Reference screens were not accessed; behaviour below that comes only from the spec is marked *(spec)*.

| Area | Current prototype | Gap against spec | Plan |
| --- | --- | --- | --- |
| Typography | Figtree | Spec requires IBM Plex Sans | Switch via `next/font/google`, one family everywhere |
| Visual language | Soft shadows on cards, inputs, buttons, sidebar | "Reduce shadows substantially" | Shadows removed from cards/fields/buttons; borders + surface contrast carry hierarchy; light shadow only on floating overlays |
| Navigation & roles | Full inventory, role switcher, central permissions, service checks | Accounts/Segments are placeholders; no account/segment permissions | Add `accounts.*` and `segments.*` permissions; same enforcement pattern |
| Activities (`/activity`) | Placeholder | Whole feed missing: categories, search, actor/date filters, detail panel, human labels, privacy | Build "Activity Feed" from audit + interaction data; default range 30 days with "Show older" |
| Contacts list | Search, filters, chips, views, bulk, export, import, duplicates | Mostly met | Reuse shared toolbar pieces; no functional loss |
| Contact form | Name / reach / work / more details | Spec order: Basic · Contact methods · Organisation & ownership · Additional details · Consent & notes | Re-section; optional consent capture on create that writes separate, auditable consent records (nothing preselected) |
| Contact workspace | Up next, composer, timeline, change history; deals/tickets/files as equal side cards | Spec asks for tabs/sections Deals · Activities · Messages · Tickets · Files · History and primary methods in header | Tabbed workspace; header shows primary phone/email; side column for details, consent, about |
| Consent | Agreed / Declined / Withdrawn, history, evidence restriction | Spec wording "refused" | Rename Declined → Refused; unknown never shown as consent |
| Import | Contacts-only wizard | "Reuse a common import pattern across modules" | Extract a shared `ImportWizard`; Contacts and Accounts plug in their own field maps, planners and appliers |
| Duplicates | Detection, compare, merge with consent conflicts | Met | Keep |
| Accounts | Static name list used by contacts | Entire module | Data model, seed with head offices/branches, list + filters (owner, type, rating, size), sectioned form, hierarchy with cycle prevention, detail workspace, import (match by number then name, update/skip, auto-create parent, ambiguous names flagged) |
| Segments | Placeholder | Entire module | Builder with "Add condition", explicit AND logic, live count + preview from real contact data, private/shared visibility, edit/delete |
| Shared components | PageHeader, DataTable, FilterPopover, ConfirmDialog, OwnerSelect, TagInput, states | Search field and filter chips duplicated inside Contacts | Extract `SearchField` and `FilterChips`; reuse in Accounts, Segments and Activity Feed |

Out of scope this phase (spec): Sales, Engagement, Service, Files, Insight and System workflows — only shared-component changes reach them.
