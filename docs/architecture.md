# Architecture

## Principles

- **Feature boundaries.** Business logic lives in `src/features/<feature>`; shared UI lives in `src/components`; framework-agnostic utilities live in `src/lib`.
- **Pure logic first.** Filtering, duplicate detection, merging, import planning, consent rules and export are pure functions in `features/contacts/lib`. They are unit-tested and reused by both UI and services.
- **Services enforce permissions.** UI hides actions a role can't perform, but every mock service function re-checks the permission and record scope. Never rely on hidden buttons.
- **One route per task.** Pages in `src/app` are thin; they render feature components.

## Folder structure

```
src/
  app/
    layout.tsx                 Root layout (Inter font, toaster)
    page.tsx                   Redirects to /dashboard
    (crm)/layout.tsx           AppShell (sidebar, top bar, hydration gate)
    (crm)/dashboard/           Role-sensitive dashboard foundation
    (crm)/contacts/            List · new · [contactId] · [contactId]/edit · import · duplicates
    (crm)/<module>/page.tsx    Placeholders for unaudited modules (accounts, leads, pipeline, …)
  components/
    ui/                        shadcn/ui (Radix) primitives — generated, lightly tuned
    layout/                    AppShell, PageHeader, PageContainer, Breadcrumbs
    navigation/                nav-config, Sidebar, GlobalSearch (⌘K), Notifications, UserMenu (role switcher)
    data-table/                DataTable (TanStack), FilterPopover, SearchField, FilterChips
    import/                    Shared ImportWizard (modules supply an adapter)
    forms/                     FormSection/Field, OwnerSelect, TagInput, useBeforeUnload
    feedback/                  ConfirmDialog, EmptyState, ErrorState, PermissionNotice, InlineNotice, skeletons
    shared/                    UserAvatar, StatusPill, BrandMark, Kbd, ModulePlaceholder
  features/
    contacts/
      components/              List page, form, detail workspace, consent, import wizard, duplicates/merge
      hooks/                   useVisibleContacts, useContact, useAssignableOwners, list UI store
      lib/                     Pure logic: access, filters, duplicates, merge, import, consent, export
      schemas/                 Zod contact form schema + mappers
      services/                contacts-service.ts (mock API with permission checks)
      types/                   Contact, ContactMethod, ConsentRecord, AuditEvent, ImportJob, SavedView
    activities/                Activity types, timeline, up-next list, composer, activities-service
    activity-feed/             Feed builder (audit + interactions → events), field-label translation, page + detail sheet
    accounts/                  Types, hierarchy/filters/import logic, form schema, service, list/form/workspace/import UI
    segments/                  Types, matching engine (AND of conditions), service, list + builder UI
    permissions/               Session store (current demo user), useCurrentUser, usePermission, <Can>
    dashboard/                 Dashboard page
  lib/
    permissions/               ROLE_DEFINITIONS (single source of truth) + pure checks
    mock-data/                 Seed generator, users/orgs, persisted db store, service helpers
    stores/                    UI preferences (sidebar collapsed)
    hooks/                     useNow
    types/                     Shared types (User, Role, Result) and prototype "related" records
    utils/                     normalize (phone/email), csv, format, id, random
    import/                    Shared import helpers: limits, file reading, alias auto-mapping, row outcomes, problem report
  styles/
    tokens.css                 Design tokens (brand values are provisional — see design-system.md)
    shadcn-variants.css        Tailwind custom variants used by shadcn components
```

> The brief suggested `companies/`; the route is `/accounts` to match the existing CRM's navigation label.

## State management

| Store | Where | Persistence | Contents |
| --- | --- | --- | --- |
| `useDbStore` | `lib/mock-data/db-store.ts` | localStorage `trovesuite-crm:prototype-db` | The whole prototype "database" (`Db` type) |
| `useSessionStore` | `features/permissions/session-store.ts` | localStorage | Current demo user id |
| `useUiStore` | `lib/stores/ui-store.ts` | localStorage | Sidebar collapsed |
| `useContactsUi` | `features/contacts/hooks/use-contacts-ui.ts` | sessionStorage | Active view, filters, page — kept while navigating |

Persisted stores use `skipHydration`; `AppShell` rehydrates them on mount and shows a skeleton until the db is ready, avoiding SSR/client mismatches. `DB_VERSION` in `db-types.ts` — bump it when the seed shape changes; stale browser data is then replaced with a fresh seed.

Components read data with selectors (`useDbStore((s) => s.db)`) and derive views with `useMemo`. They **never** call `commit` directly.

## Mock services (future API boundary)

| Service | Functions |
| --- | --- |
| `features/contacts/services/contacts-service.ts` | `createContact`, `updateContact`, `archiveContacts`, `restoreContacts`, `reassignContacts`, `recordConsent`, `mergeContacts`, `dismissDuplicatePair`, `runImport`, `saveView`, `deleteView`, `findPossibleDuplicates`, `canExport` |
| `features/accounts/services/accounts-service.ts` | `createAccount`, `updateAccount` (cycle + duplicate account-number checks), `runAccountImport` |
| `features/segments/services/segments-service.ts` | `createSegment`, `updateSegment`, `deleteSegment` |
| `features/activities/services/activities-service.ts` | `logActivity` (notes, calls, tasks, meetings, messages), `setActivityStatus` |
| `lib/mock-data/notifications-service.ts` | `markNotificationsRead` |

Every mutating function is `async`, adds simulated latency (to exercise loading states), checks permissions, writes audit events and returns `Result<T>` (`{ ok: true, data } | { ok: false, error, code }`).

### Replacing with a real backend

1. Keep the function signatures; replace bodies with `fetch` calls to the CRM API.
2. Move permission checks server-side (keep the client checks for UX only).
3. Replace `useDbStore` reads with a query cache (e.g. TanStack Query) keyed by the same shapes.
4. Pure logic in `features/contacts/lib` can stay client-side for previews (import plan, merge preview) but the server must re-validate.
5. Integration questions to resolve: authentication/session from the suite, organisation scoping, consent evidence storage, file parsing limits server-side, and how MyStoreGuard / LoanDrift syncs create contacts.

## Shared import pattern

`components/import/import-wizard.tsx` owns the four-step UX. A module supplies an `ImportAdapter`: fields + aliases, `autoMap`, `plan` (pure, returns rows with `create | update | skip | error` and issues), `run` (service that persists and returns an `ImportJob`), preview columns, copy, template, optional review extras (Accounts shows parents to be created). Contacts, Accounts and Deals use it. The deal adapter adds a "create missing contacts and companies" choice to the review step and lists every related record that will be created; `ImportJob.relatedCreated` reports them on the results screen.

## Plans and engagement

`lib/entitlements` (plan → features) is the single entitlement check; `requireFeature` in services, `useEntitlement`/`useFeatureGate`/`PlanNotice` in UI. Business settings live in `db.settings`; business-time helpers in `lib/business/time.ts`. Engagement modules share `Activity`, `Communication`, `Ticket` and `DocumentFile` (see `docs/engagement.md`). File bytes go through `lib/storage/file-store.ts` (IndexedDB) — swap it for the suite's storage service.

## Sales

`features/sales` holds types, pure calculations (`lib/calc.ts`, `lib/forecast.ts`, `lib/deal-import.ts`, `lib/lead-score.ts`), access helpers (`lib/access.ts`) and mock services. Pages never compute money themselves; they call these helpers so the board, list, quote and forecast always agree. See `docs/sales.md`.

## Activity feed

`features/activity-feed/lib/feed.ts` turns the audit trail and interaction records into viewer-specific events. Raw keys recorded by syncs (`owner_user_id`, `tag_ids`, …) are translated in `describe.ts`; unknown snake_case keys become sentence case. When a real event API exists, keep `FeedEvent` as the view model and map the API into it.

## Adding the next module

1. Create `src/features/accounts/{components,hooks,lib,schemas,services,types}`.
2. Replace `src/app/(crm)/accounts/page.tsx` placeholder with the feature page.
3. Add permissions to `PERMISSIONS` / `ROLE_DEFINITIONS` and set `status: "ready"` in `nav-config.ts`.
4. Add the module's records to the seed (and audit events for the feed); bump `DB_VERSION`.
5. Reuse `DataTable`, `FilterPopover`, `PageHeader`, `FormSection`, `ConfirmDialog`, `EmptyState`, timeline components.
