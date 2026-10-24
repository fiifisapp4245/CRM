# Sales module

Leads, Pipeline, Deals, Quotes, Products and Forecast share one data model (`src/features/sales/types`) and one calculation module (`src/features/sales/lib/calc.ts`). Every list, board, quote and chart reads the same deal records. No figure is stored twice.

## Routes

| Route | What it does |
| --- | --- |
| `/leads`, `/leads/new`, `/leads/[id]`, `/leads/[id]/edit`, `/leads/[id]/convert` | Lead list (filters, score, next action), form, workspace (status steps, interactions, next action, score breakdown, disqualify), and a conversion flow that links or creates a contact and company and optionally a deal. |
| `/pipeline` | Kanban of open stages. Drag a card, or use its **Move** menu (keyboard and screen readers). Dropping on **Won/Lost**, or choosing Mark won/lost, opens the outcome dialog — the board never closes a deal silently. Per-stage count, value and weighted value, by currency. |
| `/deals`, `/deals/new`, `/deals/[id]`, `/deals/[id]/edit` | List with Open/Won/Lost/All, attention, stage, reason, owner and currency filters plus drill-down links (`?attention=cold`, `?stage=`, `?status=won&reason=`, `?owner=`, `?currency=`). Form with manual value or products (line-item editor). Workspace with stage steps, attention notice, products and totals, activity logged against the deal, quotes and history. |
| `/deals/import` | Shared import wizard. Matches contacts by email then phone, and companies by exact name. Won and lost rows are imported with their reason and date. |
| `/quotes`, `/quotes/new?dealId=`, `/quotes/[id]`, `/quotes/[id]/edit` | Quote list, editor prefilled from the deal, preview with lifecycle actions (send, record accepted/declined/expired, record payment) and history. |
| `/q/[id]` | Simulated customer view (outside the CRM shell): view, accept, decline, simulate payment. Labelled as a prototype; it only works in the same browser. |
| `/products` | Catalogue with source (CRM / MyStoreGuard), on/off, tax and customer price. Create/edit in a side panel. |
| `/forecast` | Answers three questions in order: how much have we won, what's likely to close, are we on track. Period, scope and currency controls; secondary indicators; six-month chart with table view; breakdowns that drill into Deals and Leads. |

## Calculations (`lib/calc.ts`, `lib/forecast.ts`)

- **Line item:** quantity × unit price, less discount (0–100%), then tax. A tax-inclusive price is first divided by (1 + rate). Amounts are rounded to 2 decimal places. A quantity of 0 or less counts as 0.
- **Deal value:** manual amount, or the line-item total.
- **Probability:** the deal's own override, otherwise the stage default (New 10%, Qualified 25%, Proposal sent 50%, Negotiation 75%). Won is 100%, lost is 0%.
- **Weighted value** = value × probability. For example, GHS 10,000 at 50% = GHS 5,000.
- **Win rate** = won ÷ (won + lost), for deals closed in the period. When nothing has closed it shows "—", not 0%.
- **Attention:** *past close date* means an open deal whose expected close date has passed. *Going cold* means 14+ days with no activity or stage change.
- **Currency:** GHS and USD are summed separately everywhere. Nothing is converted.

## Prototype rules and assumptions (confirm with the business)

1. **Lead score** is a transparent prototype model (source, rating, completeness, value, recency), capped at 0–100 and shown factor by factor. It is not TroveSuite's production formula.
2. **Automatic lead owner** goes to the eligible user with the fewest open leads.
3. **Going cold** after 14 days is a prototype threshold.
4. **Quotes:** sending, the customer link, acceptance and payment are simulated in the browser. No email, link hosting or payment provider exists. A quote is editable only as a draft. A sent quote past its valid-until date shows as expired until someone records it.
5. **Accepted or paid quotes never mark the deal won.** Staff see a prompt and close the deal themselves.
6. **Payments:** "Record payment" stores a reference only. No money moves.
7. **Taxes:** "VAT 2%" and "COVID levy 4%" are reference-environment configuration copied from the existing CRM. They are not statements of Ghana tax law, and the real rates and rules must come from finance.
8. **Targets** are prototype figures: GHS 300,000 and USD 8,000 per month, set for the whole team. Individuals have no targets, so "Just me" shows "No target".
9. **MyStoreGuard products:** MyStoreGuard owns name, price, tax and SKU. The CRM can only switch a product on or off, or add a category and description. "Simulate sync" only refreshes the last-checked time; there is no API.
10. **Deal import** never creates a contact or company unless the user ticks *Create missing contacts and companies*, and every one is listed before they confirm. An import cannot change won or lost outcomes. Updating a deal that is valued from products keeps its calculated value.
11. **Scopes:** leads, deals and quotes follow the same owner scopes as contacts (User: own and unassigned; Manager: team; Admin and Viewer: all). Quotes inherit their deal's visibility.

## Seed

18 leads (one converted, and examples of every status), 15 products (MyStoreGuard-synced, tax-inclusive, switched off and USD), 34 deals in every state: open, won, lost, going cold, past close and USD. Seven quotes cover every status, and there are monthly targets for −6 to +6 months. All of them reference real seed contacts and accounts. DB version 5 migrates a v4 browser in place, keeping contacts, accounts, segments, activities and audit, and swapping the old read-only deal stubs for real deals.
