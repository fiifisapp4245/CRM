# Design system

## Principles

1. **Task first.** Each screen answers "what do I need to do next?" before "what data exists?".
2. **Calm density.** CRM users scan a lot of records: compact 36 px controls, 14 px body text, generous section spacing, restrained borders.
3. **Colour means something.** Brand cyan is for primary actions, selection and focus. Green / amber / red / blue are reserved for status. No decorative gradients.
4. **Progressive disclosure.** Rare fields (gender, birthday, address, tags, notes) sit behind "More details"; destructive or rare actions go in overflow menus.
5. **Every action has an outcome.** Toasts for success (with Undo where sensible), inline messages for validation, confirmation dialogs for anything destructive or bulk.
6. **Accessible by default.** Visible focus rings, labelled controls, keyboard-operable rows, menus, tabs and dialogs (Radix).

## Visual direction — restrained enterprise (Phase 2)

Phase 2 spec: restrained, modern enterprise SaaS; brand preserved; shadows substantially reduced; hierarchy from borders, spacing, surface contrast and type.

- **Shape language:** buttons, fields, search, selects and the view switcher use a moderate 10 px radius (`rounded-lg`); chips, status labels and tab items inside switchers use 8 px (`rounded-md`); cards 16–18 px. Only avatars, toggles and progress bars stay fully round.
- **Surfaces:** the main content area is white (`#ffffff`); the sidebar and top bar share a light grey panel (`#f3f6f7`) and are separated from the content by a 1 px stroke. Cards are white with a 1 px border. **No shadows on resting surfaces** (cards, fields, buttons, nav). Only floating layers — menus, popovers, dialogs, sheets, toasts and the bulk-action bar — carry `--shadow-md`.
- **Active states:** a white fill plus a hairline ring (sidebar item, segmented control), never a lift.
- **Identity colour:** avatars use six soft, name-hashed tints. Brand cyan is reserved for actions, selection and focus.
- **Headers on the canvas:** page, contact and account headers sit on the canvas, not inside cards.

## Tokens — `src/styles/tokens.css`

### Brand (PROVISIONAL)

Read from the existing CRM's compiled CSS (default accent = cyan) and favicon (`#0891b2`); **not** confirmed against an official brand guide. Replace in `tokens.css` only.

| Token | Value | Use |
| --- | --- | --- |
| `--brand-50/100/200` | `#effbfd` / `#d5f3f8` / `#a9e5ef` | Selected backgrounds, chips, selection highlight |
| `--brand-500` | `#13a7c4` | Focus ring |
| `--brand-600` | `#0891b2` | Logo mark, bars, non-text accents |
| `--brand-700` | `#0e7490` | **Primary buttons, links, active icons** (≈5.4 : 1 on white) |
| `--brand-800/900` | `#135d73` / `#164a5b` | Text on brand tints, primary hover |

### Neutrals, semantic and depth

| Token | Value |
| --- | --- |
| `--background` / `--panel` / `--card` | `#ffffff` (content) / `#f3f6f7` (sidebar, top bar) / `#ffffff` |
| `--foreground` | `#10242c` (teal-tinted ink) |
| `--muted-foreground` | `#56707a` (≥4.8 : 1 on canvas and card) |
| `--subtle-foreground` | `#7a8f97` (icons and decorative meta only) |
| `--border` / `--border-strong` / `--input` | `#e3eaed` / `#cfdbe0` / `#d5dfe3` |
| Status | success `#17804a`, warning `#a65a07`, destructive `#c8323a`, info `#2b5fc7`, each with a `*-soft` background |
| `--tint-1…6-bg/fg` | Avatar identity tints |
| `--shadow-xs/sm/primary` | `none` — resting surfaces have no shadow |
| `--shadow-md` | Floating layers only (menus, dialogs, sheets, toasts) |

## Tabs

There is one tab style: the segmented control first used for the contact list views — a grey track (`bg-secondary`, 10 px radius) holding options, with the selected option as a white tile with a hairline ring. `components/ui/tabs.tsx` exports the shared classes (`tabListClass`, `tabTriggerClass`, `tabTriggerActiveClass`); Radix `Tabs` and `Segmented` both use them. Used by: contact list views, activity feed categories, contact and account page sections, the activity composer, timeline filters and import row filters. Don't add underline tabs or chip toggles.

## Record profile header (`ProfileBanner`)

`components/shared/profile-banner.tsx` — used by contact and account pages. It's a banner card: a tinted cover band (brand-50 with a faint dot texture; grey when the contact isn't active), an overlapping 96 px avatar, actions on the right, name and title/account below, then a facts row. Contacts show phone, email, owner (with Change) and last activity; accounts show a building mark, type and rating, head office/branch line, and account number, phone, owner and last updated.

## Typography

- **IBM Plex Sans** (400/500/600/700) via `next/font/google`, applied to every element through `--font-sans` — headings, body, controls, tables, dialogs and navigation. No other families.
- Body 14 px / 1.5. Page and record titles 28 px semibold, −0.02em. Card titles 15 px semibold. Meta 12–13 px muted.
- Numbers in tables and stats use `tabular-nums`. Technical identifiers (event IDs, field keys) use the monospace stack only inside "Technical details".

## Spacing, motion, browser surfaces

- Page gutter `px-4 sm:px-6 lg:px-10`, top `pt-7`; sections `gap-7`; card padding 20–24 px.
- Transitions 150–200 ms ease-out on colour, shadow and border. Buttons press to 98% scale. No page-load choreography.
- Themed text selection (`brand-100`), caret (`brand-700`), slim rounded scrollbars, 3 px underline offset.

## Layout

- Sidebar 256 px (collapsible to 72 px, persisted); below `lg` it becomes a drawer.
- Sticky 64 px translucent top bar: pill search (⌘K), notifications, account pill.
- `PageContainer` widths: `wide` (1360 px) for lists and workspaces, `narrow` (896 px) for forms.
- Grids use `grid-cols-[minmax(0,1fr)]` on mobile so long content can't force sideways scrolling.
- The contacts table combines phone and email into one **Reach** column, and shows status inside the name cell only when a contact isn't active, so it fits a laptop width without scrolling.

## Component conventions

| Need | Use |
| --- | --- |
| Page title + actions + breadcrumbs | `PageHeader`, `Breadcrumbs` |
| Tabular data | `DataTable` (TanStack) — sorting/filtering happen upstream so counts, export and table agree |
| Multi-select filter | `FilterPopover` + removable chips |
| Person picker | `OwnerSelect` (searchable; pass only eligible users) |
| Long form | `FormSection` + `Field` (label, hint, error with `role="alert"`) + sticky save bar |
| Confirmation | `ConfirmDialog` (supports async confirm with spinner) |
| Empty / error / no access | `EmptyState`, `ErrorState`, `PermissionNotice` |
| Inline message | `InlineNotice` (`info`, `warning`, `danger`, `success`, `neutral`) |
| Status | `StatusPill` and feature wrappers (`ContactStatusBadge`, `ConsentBadge`) |
| Search box | `SearchField` |
| Active filters | `FilterChips` |
| Tabs with panels | `Tabs` / `TabsList` / `TabsTrigger` (`components/ui/tabs.tsx`) |
| Single-choice views, categories and filters | `Segmented` — same look as `Tabs` |
| Multi-value picker in forms | `MultiSelect` |
| Account picker | `AccountSelect` |
| Any import | `components/import/ImportWizard` + a module adapter |
| Record page header | `ProfileBanner` |

Dialog content components are mounted only while open, so form state resets naturally on each open (no "reset in effect" code).

## Writing style

Plain, specific, second person. Buttons say what happens ("Archive", "Record preference", "Import 7 contacts"). Errors say how to fix ("Enter a first name or a last name."). Avoid jargon such as "entity" or "record ID" in UI copy.

## Charts (Sales forecast)

- Won = `#0891b2` (brand-600), weighted pipeline = `#d97706`, rest of open pipeline = `#f6d7ad` (a tint of the weighted hue, because weighted is part of open), target = dashed `#56707a`. The won/weighted pair was checked with the dataviz palette validator: CVD ΔE 19, both at least 3:1 on white.
- Bars have 4px rounded tops, a 2px surface gap where weighted sits inside open, a recessive grid, a legend above the chart, a per-month hover tooltip, and a table view as the accessible alternative.
- Status colours (success, warning, danger) are never used as chart series.
