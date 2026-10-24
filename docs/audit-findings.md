# Audit findings and decisions

Scope so far: **Dashboard** and **Contacts** (from the initial UX audit summarised in the Phase 1 brief). Accounts and the remaining modules will be added after their audits.

## Dashboard

| Observed problem | Recommendation | Implemented decision |
| --- | --- | --- |
| Revenue, deals, win rate, pipeline, new customers, leads, activities, tickets, charts and team data are mixed in one view for everyone. | Make the dashboard role-sensitive and task-led; move analysis to Reports/Forecast. | Separate layouts per role: User (my follow-ups, deals needing attention, contacts going quiet), Sales Manager (team activity, exceptions, overdue follow-ups, pipeline counts), Viewer (read-only summaries), Admins (data-health indicators and admin entry points). |
| Financial figures without a defined method. | Don't show money metrics until Pipeline/Forecast are audited. | Pipeline panel shows deal **counts by stage only**. *(Sales phase: money now appears on Deals, Pipeline and Forecast with documented formulas — see `docs/sales.md`.)* |

## Contacts

| Observed problem | Recommendation | Implemented decision |
| --- | --- | --- |
| Contacts behave like forms and tables, not a relationship workspace. | Task-oriented profile: who, how to reach, owner, what happened, what's next. | `/contacts/[id]`: header with owner and key actions, "Up next" (tasks/meetings), inline composer, interaction timeline, and a side column for contact details, communication preferences, about, deals, tickets, files. |
| Interaction history and system changes are not clearly separated. | Two histories. | "Interactions" tab (calls, notes, meetings, messages, completed tasks) vs "Change history" tab (audit events with before/after values). |
| A phone number shown on the profile appeared as an empty phone input in the edit form. | Map every stored method into the form verbatim. | `contactToForm` copies all methods; regression test `pre-populates every contact method when editing (phone-only regression)`; verified in the browser on Kwesi Arthur. |
| Email/phone requirements unclear. | Don't require either without a business rule. | Only a first or last name is required. Display name is generated but editable, with "Use generated" to revert. |
| Phone formats vary (024…, +233…, 233…, international). | Normalise for matching without assuming Ghana for `+` numbers. | `normalizePhone`: national `0…` → `+233…`; `+`/`00` prefixes kept; Ghana numbers validated to 9 digits after `+233`. |
| Consent mixed with general editing; agreement could be preselected. | Dedicated, auditable workflow per channel with history. | "Record communication preference" dialog: channel, purpose (marketing / service updates), decision (nothing preselected), method filtered by decision (e.g. "Replied STOP" only for withdrawal), note, evidence reference. History is append-only; current status = latest record. |
| Marketing could be sent without permission. | Block marketing without agreement; distinguish operational messages. | Send-message dialog blocks marketing unless "Agreed" is on record for that channel; operational messages allowed unless service updates were declined/withdrawn. Labelled as a product assumption, not legal guidance. |
| Owner list contains duplicate identities and QA/test accounts. | Only eligible users. | `eligibleOwners` excludes inactive, test and duplicate identities, and other organisations. |
| Filters not visible once applied. | Visible, removable chips; reset; saved views. | Chips per filter, "Reset filters", "Save as view", built-in views (All, My contacts, Unassigned, Recently added, Archived). View/filters persist while navigating. |
| Source could be read as access to MyStoreGuard/LoanDrift data. | Treat source as provenance only. | Source shown as text; profile explains it doesn't grant access to the other app's data. |
| Import capabilities (csv/xlsx, 10 MB, 10,000 rows, template, mapping, duplicate match by email/phone, update/skip). | Guided, reviewable import; nothing changes before confirmation. | 4-step wizard: Upload → Review (column mapping incl. custom fields, row-level outcomes and reasons) → Confirm (explicit checkbox) → Results (counts, problem-row CSV, history). Rows matching more than one contact, or a contact the user can't access, are rejected instead of guessed. |
| Duplicate review needs evidence and control. | Show why, compare side by side, choose survivor and conflicting values, preview, confirm, audit. | `/contacts/duplicates` with "Not duplicates" dismissal and a merge dialog. All activities, consent records (tagged with origin), deals, tickets and files move to the kept record; secondaries are soft-merged and redirect. Consent conflicts are shown explicitly; the most recent decision becomes current and no history is dropped. |

## Activities → Activity feed (Phase 2)

| Observed problem | Decision |
| --- | --- |
| "Activities" is easily confused with Tasks & Calls | Labelled **Activity feed**; route `/activity` kept for compatibility |
| Default Today + Yesterday often shows nothing | Default **Last 30 days**, with Last 90 days / All time / custom range, and "Show older activity" when more exists |
| Raw field keys shown (`middle_names`, `owner_user_id`, `tag_ids`, `full_name`) | Translated to readable labels; ids resolved to names; raw keys only under "Technical details" |
| Detail panel useful but mixed technical and human info | Side sheet: event, record link, actor, time, before/after (only when recorded) — technical metadata collapsed separately |
| Sensitive details visible to everyone | Events about inaccessible records are dropped; values hidden for roles without change history; Settings only for admins |

## Accounts (Phase 2)

| Spec requirement | Decision |
| --- | --- |
| Same table/filter conventions as Contacts | Shared SearchField, FilterPopover, FilterChips, DataTable; filters Owner, Type, Rating, Size + Structure |
| Reduce form load | Basics first; business details behind "Show account number, ownership, size and revenue"; addresses/tags/notes in a disclosure |
| Hierarchy | Head office / Branch shown in list, header and a Structure tree; parent picker excludes self and descendants; service rejects cycles |
| No assumed inheritance | Branches keep their own contacts, owner and billing; stated in the form and Structure tab |
| Import | Shared wizard; account number then name; ambiguous names rejected; empty cells never erase; missing parents listed before confirmation and created |

## Segments (Phase 2)

| Spec requirement | Decision |
| --- | --- |
| Every condition shown at once | "Add condition" menu; only chosen conditions appear |
| Explicit logic | Stated in the UI and shown with AND separators: all conditions must match; any selected value within a condition |
| Live feedback | Count and preview list recompute from real contact data on every change |
| Consent-sensitive use | Consent condition uses current decision only; a notice says membership isn't permission to message |
| Saved segment management | Private/shared, edit, delete with confirmation; read-only for people who can't edit |

## Open questions

1. What exactly does "Status" mean in the existing CRM — only Active/Archived, or also lifecycle stages (lead, customer, …)?
2. Which roles see which contacts in the real backend (see `permissions.md` assumptions)?
3. Are custom fields defined centrally (Settings) or created ad hoc on import?
4. What consent purposes exist beyond marketing and service updates, and which markets' rules apply?
5. Where is consent evidence stored, and who may view it?
6. How do MyStoreGuard and LoanDrift sync contacts — create only, or update too? Who owns synced contacts?
7. Should export be audited per record or per export job, and should it include notes/date of birth? (Prototype excludes both.)
8. What's the difference between "Activities" (`/activity`) and "Tasks & Calls" (`/activities`)? Both routes are preserved.
9. Is there a hard delete in the existing CRM, and who can use it?
10. Should brand accents (blue/green/purple) remain user-selectable?
11. Does the real segment engine support OR groups or nested conditions? The prototype keeps a fixed AND.
12. Are segment counts computed per viewer (prototype) or org-wide in the real system?
13. Can CRM Users and Viewers read every account, or only accounts linked to their contacts?
14. When an import creates a missing parent, who should own it, and what type should it get? (Prototype: importer for CRM Users, otherwise unassigned; type Customer.)
15. Which audit events count as "sensitive" for the activity feed, beyond date of birth and notes?
16. What do the existing feed's Sales and Settings events contain? The prototype seeds representative ones.
