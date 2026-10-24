@AGENTS.md

# TroveSuite CRM prototype — notes for future sessions

Read before changing anything:
- docs/architecture.md — structure, stores, services, how to add a module
- docs/design-system.md — tokens (brand values are provisional), component conventions
- docs/permissions.md — permission matrix and unverified assumptions
- docs/audit-findings.md — decisions and open questions
- docs/module-progress.md — what's done / pending
- docs/implementation-log.md — append an entry for each phase

Rules:
- Only build modules after their UX audit is supplied; otherwise keep the placeholder.
- All data is fictional and local. Never connect to crm.dev.trovesuite.com.
- UI must not write to the db store directly — go through a feature service that checks permissions.
- Put business rules in pure functions under `features/<feature>/lib` and test them with Vitest.
- Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` before finishing.
