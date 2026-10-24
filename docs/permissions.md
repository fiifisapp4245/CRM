# Roles and permissions

**Status: prototype interpretation.** The matrix below is NOT a verified copy of the existing backend's rules. It lives in one file — `src/lib/permissions/config.ts` — and both the UI and the mock services read it. Change it there when the real rules are known.

## Model

- **Action permissions** (e.g. `contacts.merge`) decide whether a role can perform an action at all.
- **Record scope** decides which contacts the role can read and change:
  - `all` — every record in the user's organisation
  - `team` — records owned by the user or their direct reports, plus unassigned records
  - `own` — records owned by the user, plus unassigned records
  - `none` — no write access
- **Organisation boundary** is absolute: no role can read, match, import into or merge records from another organisation (tested with a second fictional tenant, "Volta Agro Supplies").
- **Inactive users** have no permissions.
- Navigation visibility is convenience only; all service functions check permissions and scope again.

## Roles (demo persona)

| Capability | Sales Manager (Ama) | CRM User (Kwame) | Viewer (Yaw) | CRM Admin (Abena) | Suite Admin (Kofi) |
| --- | :-: | :-: | :-: | :-: | :-: |
| Read scope | team | own | all | all | all |
| Write scope | team | own | none | all | all |
| View contacts | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create / edit contacts | ✓ | ✓ | — | ✓ | — |
| Archive | ✓ | ✓ | — | ✓ | ✓ |
| Restore | ✓ | — | — | ✓ | ✓ |
| Change owner | ✓ | — | — | ✓ | ✓ |
| Import | ✓ | ✓ | — | ✓ | — |
| Export | ✓ | ✓ | — | ✓ | ✓ |
| Merge duplicates | ✓ | — | — | ✓ | ✓ |
| View change history | ✓ | ✓ | — | ✓ | ✓ |
| Record consent | ✓ | ✓ | — | ✓ | — |
| View consent evidence | ✓ | — | — | ✓ | — |
| Log activity / send messages | ✓ | ✓ | — | ✓ | — |
| Team dashboard | ✓ | — | — | ✓ | — |
| Forecast (nav) | ✓ | — | — | ✓ | — |
| Settings (nav) | — | — | — | ✓ | ✓ |
| Reports (nav) | ✓ | — | ✓ | ✓ | ✓ |
| View accounts | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create / edit / import accounts | ✓ | ✓ | — | ✓ | — |
| View segments | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create segments (and edit own) | ✓ | ✓ | — | ✓ | — |
| Edit / delete others' shared segments | — | — | — | ✓ | ✓ |
| Activity feed | ✓ | ✓ | ✓ | ✓ | ✓ |
| View leads, deals, pipeline, quotes, products | ✓ | ✓ | ✓ | ✓ | ✓ |
| Forecast | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create / edit / convert leads | ✓ | ✓ | — | ✓ | — |
| Create / edit / move / close deals | ✓ | ✓ | — | ✓ | — |
| Import deals | ✓ | ✓ | — | ✓ | — |
| Create and progress quotes | ✓ | ✓ | — | ✓ | — |
| Manage products | ✓ | — | — | ✓ | — |
| Plan, log, edit and import activities | ✓ | ✓ | — | ✓ | — |
| Send messages (Advance) | ✓ | ✓ | — | ✓ | — |
| Manage message templates (Advance) | ✓ | — | — | ✓ | — |
| Manage campaigns (Premium) | ✓ | — | — | ✓ | — |
| Work tickets (Advance) | ✓ | ✓ | — | ✓ | — |
| Manage saved answers (Advance) | ✓ | — | — | ✓ | — |
| Upload and manage documents | ✓ | ✓ | — | ✓ | — |
| Feed: change values on contacts | ✓ | ✓ | — | ✓ | ✓ |
| Feed: Settings category | — | — | — | ✓ | ✓ |

## Owner eligibility

Only users who are **active**, in the **same organisation**, **not test/QA accounts**, **not duplicate identities**, and hold a record-owning role (User, Sales Manager, CRM Admin) appear in owner pickers. Users can only assign to people inside their own write scope (a Sales Manager sees their team; a CRM User sees only themselves).

## Unverified assumptions — please confirm

1. CRM Users see only their own and unassigned contacts. (They may see all org contacts in the real system.)
2. Unassigned contacts are visible and editable by every role with write access, so they can be claimed.
3. CRM Users can archive their own contacts but cannot restore; managers/admins restore.
4. CRM Viewers cannot export. The brief lists create/edit/delete/import/merge as forbidden but doesn't mention export.
5. Suite Administrators govern CRM data (archive, restore, reassign, merge, export, audit) but do not create contacts, record consent, see consent evidence or log customer activity.
6. "Team" means direct reports via `managerId`. The real system may use teams, territories or branches.
7. Consent evidence references are visible to Sales Managers and CRM Admins only.
8. Contacts owned by an inactive user stay visible to that user's manager (team scope includes former reports).
9. There is no hard delete in the prototype — archive is the only removal, and merge is a soft operation.
10. Every CRM role can **read all accounts** in the organisation; write access follows the owner scope used for contacts.
11. Changing an account's owner uses the same `contacts.reassign` permission as contacts.
12. Accounts imported by a manager or admin without an owner column stay unassigned; a CRM User's imports are owned by the user.
13. Segment counts are computed from the **viewer's** accessible active contacts, so two people can see different counts for a shared segment.
14. Private segments are visible to their creator only — admins can't see them either.
15. The activity feed shows only events about records the viewer can read. Roles without change-history access see *that* fields changed, not their values. Consent evidence never appears in the feed.
16. Leads, deals and quotes use the contact owner scopes; quotes follow their deal. Unassigned leads are visible to CRM Users so they can be claimed.
17. CRM Users can't create or edit products; Sales Managers and CRM Admins can. Suite Admins and Viewers read sales data but change nothing.
18. Targets exist for the whole team only; per-person targets are not modelled.
19. Plan entitlements are separate from roles: a role permission is necessary but not enough — Messaging/Tickets also need Advance, Campaigns Premium (see `docs/engagement.md`).
20. Internal activities (no contact) follow their owner's scope; attendees can also see them.
21. Tickets are visible to anyone who can see the customer; changing one follows owner scope.
22. Documents are shared org-wide; Viewers and Suite Admins can browse but not change them.
