# TroveSuite CRM — UX Prototype

An interactive, production-quality UX prototype for the redesigned **TroveSuite CRM**. It is built module by module from UX audits of the existing CRM (`https://crm.dev.trovesuite.com/`, used only as a functional reference).

**Built so far:** application shell, role/permission model, mock data layer, a role-sensitive Dashboard foundation, and the **Activity feed**, **Contacts**, **Accounts**, **Segments**, **Sales** (Leads, Pipeline, Deals, Quotes, Products, Forecast) and **Engagement, Service and Files** (Tasks & Calls, Calendar, Messaging, Campaigns, Tickets, Documents) modules. Reports and Settings are route placeholders until their audits.

> All people, companies, phone numbers and emails are fictional. Phone numbers use a `555` block and emails use the reserved `.example` domain. The prototype never talks to the real CRM — all data lives in your browser's localStorage.

## Run it

Requirements: Node 20+ (tested on Node 24) and npm.

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build (what Vercel runs) |
| `npm start` | Serve the production build |
| `npm test` | Unit tests (Vitest) for normalisation, validation, permissions, import, merge, export |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (Next.js + React Compiler rules) |

## Trying it out

- **Switch role:** open the profile menu (top right) → *Prototype: view as role*. Each role maps to a demo person (e.g. CRM User → Kwame Boateng, Sales Manager → Ama Mensah).
- **Reset data:** profile menu → *Reset demo data*. Restores the seed; your chosen role is kept.
- **Good starting points:** `/activity` (feed and detail panel), `/contacts/ct_abigail` (tabs, consent), `/accounts/acc_coastal_pharm` (head office and branches), `/segments/seg_sms_marketing` (live count), the import pages for contacts, accounts and deals → *Use sample file*, `/pipeline` (drag or Move menu), `/deals/dl_coastal_branch` (products and quote), `/quotes/qt_103` → *Open* customer link, `/forecast`, `/activities` → *Log a call*, `/calendar` (drag an event), `/tickets?view=dashboard`, `/documents` (drop a file).

## Deploy to Vercel

The project is a standard Next.js App Router app with no environment variables and no server-side data.

1. Push the project to a Git repository (GitHub, GitLab or Bitbucket).
2. In Vercel: **Add New → Project**, import the repository. Framework preset: **Next.js** (auto-detected). Leave build command (`next build`) and output settings at their defaults.
3. Deploy. Every visitor gets their own local demo data.

Or from the command line:

```bash
npx vercel        # preview deployment
npx vercel --prod # production deployment
```

No deployment has been made from this workspace.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui on Radix UI primitives · Lucide icons · TanStack Table v8 · React Hook Form + Zod · Zustand (with `persist`) · IBM Plex Sans (Google Fonts) · Sonner toasts · `read-excel-file` (xlsx import) · Vitest.

## Documentation

| Doc | Purpose |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Folder structure, feature boundaries, state, mock services, backend integration points |
| [docs/design-system.md](docs/design-system.md) | Principles, tokens (incl. provisional brand values), typography, components |
| [docs/permissions.md](docs/permissions.md) | Roles, prototype permission matrix, unverified assumptions |
| [docs/audit-findings.md](docs/audit-findings.md) | Problems observed, improvements, decisions, open questions |
| [docs/module-progress.md](docs/module-progress.md) | What's done, pending, and known limitations |
| [docs/implementation-log.md](docs/implementation-log.md) | Change log per phase |
| [docs/gap-analysis-phase-2.md](docs/gap-analysis-phase-2.md) | Gap analysis behind the Phase 2 refinement |
| [docs/sales.md](docs/sales.md) | Sales routes, formulas, prototype rules and assumptions |
| [docs/gap-analysis-sales.md](docs/gap-analysis-sales.md) | Gap analysis behind the Sales phase |
| [docs/engagement.md](docs/engagement.md) | Phase 3 model, plans, fidelity report and prototype rules |
| [docs/gap-analysis-engagement.md](docs/gap-analysis-engagement.md) | Gap analysis behind Phase 3 |
| [docs/report.md](docs/report.md) | Final report: what was built, checklist, fidelity, testing, next steps |
