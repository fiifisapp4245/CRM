# Gap analysis — Sales (Phase 3 of the build, "Phase 2: Sales" in the brief)

Inspected: `src/app/(crm)` routes, nav config, `lib/types/related.ts`, seed, db store/migration, permission config, Phase 1 shared components (DataTable, FilterPopover, FilterChips, SearchField, Segmented/Tabs, ProfileBanner, ImportWizard, OwnerSelect, ConfirmDialog, timeline/composer).

| Area | Current prototype | Gap | Plan |
| --- | --- | --- | --- |
| Routes | `/leads`, `/pipeline`, `/quotes`, `/products`, `/forecast` are placeholders; no `/deals` | Everything | Build all six areas plus detail, edit, convert, import and a customer quote view |
| Data model | `DealRef` (read-only stub: name, stage label, amount, close date); no leads, products, quotes, pipelines, taxes or targets | Real relational model | `features/sales/types`: Lead, Pipeline/Stage, Deal (+ line items), Product, Tax, Quote, SalesTarget; Activity gains optional `dealId` |
| Calculations | None | Line items, tax-inclusive, totals, probability, weighted, win rate, days to close, attention, lead score | One pure module `features/sales/lib/calc.ts` (+ tests) used by every page |
| Seed | Deals generated per contact as display stubs | Coherent dataset | Leads, products (GHS + one USD, MyStoreGuard-sourced, switched-off), deals across stages incl. won/lost/going cold/past close/USD, quotes in every status, targets — all referencing real contacts/accounts |
| Persistence | Versioned localStorage db; version bump reseeds everything | Must not silently replace user records | v4→v5 **migration keeps existing contacts, accounts, segments, activities and audit**, swaps the read-only deal stubs for real deals and adds the sales data |
| Permissions | No sales permissions | Role-aware sales | `sales.view`, `leads.manage`, `deals.manage`, `deals.import`, `quotes.manage`, `products.manage`; owner scope reused for leads and deals |
| Cross-module | Contact/account Deals tabs, dashboard and feed read `DealRef` | Must use the real deals | Update those consumers; deals/leads/quotes link both ways; sales events in the activity feed |
| Shared UI | Import wizard, tables, filters, banner, tabs exist | Line-item editor, money display, stage progress, close dialogs, chart | Add as shared sales components; reuse everything else |
