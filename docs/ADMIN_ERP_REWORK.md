# Cellvix Admin — ERP Rework Plan

> **Status:** in build. **Phases 1–12 are done** — shell, kit, dashboard, sales depth, purchase,
> reports, quotes & RMA, outlet/staff/roles, marketing, referrals, settings (in five passes) and the
> cross-cutting work (search, profile, detail screens, exports, and the notification bell in 12c).
> See §10 and the Session 24–36 entries in [PROGRESS.md](../PROGRESS.md).
> **Phase 13 is what remains**: clearing the §6b register by wiring the shells — Twilio, WhatsApp,
> telephony, Google OAuth and the calendar’s scheduling logic — each independently shippable.
>
> **Phase 6 pulled two things forward, deliberately.** `Order.items.unitCost` now snapshots cost at
> order time (§9.4) — margin cannot be computed honestly without it. And the **`Settings` singleton
> exists from now on**, seeded with per-province tax rates: §10 warns against hard-coding a rate and
> migrating it later, so phase 11 builds only the *screens* that edit it.
> **Decided 2026-08-27:** the Cellvix admin panel is rebuilt as a full ERP console modelled on
> **CellShoppe Phone & Laptop Fix** (`dev.techonwheelz.ca/admin`), so one operator can run both
> businesses without relearning a second layout.
>
> **Cellvix is now the ERP.** There is no external system of record and no sync adapter. The old
> `docs/ERP_INTEGRATION.md` and its HTML map have been deleted — everything they described is
> superseded by this document.
>
> Read [PROJECT_INSTRUCTIONS.md](../PROJECT_INSTRUCTIONS.md) first — every rule there still binds
> this work. This file is the *what and where*; the Instructions remain the *how*.
>
> ---
>
> ## ⚠ Superseded in four places — read [SAAS_PLATFORM.md](../SAAS_PLATFORM.md) §2 first
>
> **Decided 2026-09-03:** Cellvix is **tenant #1 of a multi-tenant ERP SaaS**, and the client's
> requirement is now a **100% CellShoppe section match**, with anything inapplicable to Cellvix
> **switched off rather than dropped**. That changes four things in this document:
>
> 1. **§0.7 and §2b dropped `Web Quote`. Overturned 2026-09-03 — it is being built.** It is the
>    **storefront Contact Us inbox**, over the `ContactMessage` model that already stores
>    submissions, converting to a real `Quote` through `pricingService`. SAAS_PLATFORM §2.3.1.
> 2. **§3's Ticket → RMA rename is overturned 2026-09-03: RMA is dropped as a section and a return
>    request is a Ticket.** One pipeline record carrying a `type`. §6.3's RMA behaviour — SLA, states,
>    reason codes — survives as ticket fields; the `Rma` data is **migrated, not dropped**, refunds
>    still route through `storeCreditService`, and `/admin/rma*` redirects. SAAS_PLATFORM §2.2.1.
> 3. **§3's Tech Performance → Staff Performance rename is still a pending ruling.** It stays in
>    force until ruled on. In the platform these nouns become industry-preset vocabulary
>    (SAAS_PLATFORM §7.3), so ruling it decides what *Cellvix* ships, not what the product allows.
> 4. **§2's sidebar tree is an accurate record of CellShoppe but no longer of Cellvix.** Tickets,
>    Supplier Returns, Subscription Plans and Service Products were added after it was written.
>    **`ADMIN_NAV` in [`shared/schemas/admin.js`](../shared/schemas/admin.js) is the source of truth**
>    for what exists.
>
> Nothing else here is superseded. Every invariant in §11 still binds, and
> [SAAS_PLATFORM.md](../SAAS_PLATFORM.md) §10 adds ten more.
>
> **New sections are gated by a feature flag from now on** (SAAS_PLATFORM §3): a nav row names the
> flag that gates it, and a disabled feature's routes return `404` server-side. Off is invisible, not
> broken — and never destructive.

---

## 0. Settled scope

| # | Question | Decision |
|---|---|---|
| 1 | Does the storefront get deleted? | **No.** The buyer-facing site (Shop-as-homepage, product detail, cart, checkout, account, blog, FAQ, offers, about, contact) stays exactly as built. Only `/admin` is reworked. |
| 2 | What ships this session? | **This document only.** All screenshots are now in, so the plan is complete and ready to build against. |
| 3 | How do repair-shop concepts translate? | **Closest B2B equivalent.** Sidebar *shape* stays identical to CellShoppe; the records underneath become wholesale-native. See §3. |
| 4 | Is this panel replacing the external ERP? | **Yes.** Cellvix owns products, stock, pricing, orders, invoices, AR, purchasing and outlets outright. No integration layer. |
| 5 | What does **Outlet** mean? | **Physical stores.** Different staff manage different stores. See §6.14. |
| 6 | Admin roles? | **One admin role with full power**, plus staff whose permissions the admin selects per section. See §7.6. |
| 7 | Are quotes self-serve for buyers? | **Admin-created only, for now.** No storefront quote-request entry point in this build. |
| 8 | Expense categories? | **Admin-managed.** A CRUD screen behind the `Categories` button. |
| 9 | Multi-warehouse? | **One location now**, modelled so more can be added later without a migration. |
| 10 | Scheduling & Booking? | **Build the UI only.** Calendar and Appointments render; wiring comes later. See §6b. |
| 11 | Referral commission? | **Yes, build it.** A referrer earns a % of their referral's payments as store credit. See §6.13. |
| 12 | Warranty lengths per grade? | **Dummy values now**, real numbers later. Editable in Settings from day one. |
| 13 | GST/HST rates? | **Standard 2026 provincial rates now**, to be confirmed. Editable in Settings. |
| 14 | Message providers (SMS / WhatsApp / call)? | **UI only.** Compose, log and template; no live send until keys land. See §6b. |
| 15 | Business contact details? | **Dummy data now**, real details later. Editable in Settings. |

### What "no catalogue, about us, contact us, blog pages" means here

The admin panel is not a website CMS — it is an operations console. The storefront still renders a
blog and a FAQ, so their **editors survive**, but they move out of the top level and live under
**Marketing** alongside the other outbound-communication tools. The admin sidebar never again lists
a public page as if it were a workspace.

---

## 1. Where we are today

The current `/admin` is a **flat, eight-item sidebar** inside the storefront shell:

```
Overview · Approvals · Orders · Products · Customers · Offers · Blog · FAQs
```

| Asset | File | Fate in the rework |
|---|---|---|
| Admin shell | [`client/src/components/admin/AdminLayout.jsx`](../client/src/components/admin/AdminLayout.jsx) | **Replaced.** Becomes a full-height ERP shell (§4). |
| Nav definition | [`shared/schemas/admin.js`](../shared/schemas/admin.js) → `ADMIN_NAV` | **Replaced** by a two-level `ADMIN_NAV` tree (§5). |
| Overview | `AdminOverviewPage.jsx` | **Rebuilt** as the ERP Dashboard (§6.1). |
| Approvals | `AdminApprovalsPage.jsx` | **Kept**, moved under Sales → Clients as a status filter. |
| Orders | `AdminOrdersPage.jsx` | **Kept and extended** → Sales → Orders. |
| Products | `AdminProductsPage.jsx` | **Kept and extended** → Purchase → Inventory. |
| Customers | `AdminCustomersPage.jsx` | **Kept and extended** → Sales → Clients. |
| Offers | `AdminOffersPage.jsx` | **Moved** → Marketing → Offers. |
| Blog | `AdminBlogPage.jsx` | **Moved** → Marketing → Blog. |
| FAQs | `AdminFaqPage.jsx` | **Moved** → Marketing → FAQ. |

Nothing above is thrown away. The rework is **re-homing plus new sections**, not a rewrite of
working screens.

### Existing server surface

All admin endpoints live in [`server/src/routes/index.js`](../server/src/routes/index.js) behind
`[requireAuth, requireAdmin]`, backed by
[`adminService.js`](../server/src/services/adminService.js) and
[`contentController.js`](../server/src/controllers/contentController.js).

Models present: `User` · `Product` · `Order` · `Invoice` · `CreditTransaction` · `Offer` · `Cart` ·
`BlogPost` · `Faq` · `Taxonomy` · `ContactMessage`.

Models **absent** and required by the ERP: `Supplier` · `PurchaseOrder` · `Expense` ·
`ExpenseCategory` · `Quote` · `Rma` · `StockMovement` · `Outlet` · `Campaign` · `MessageLog` ·
`Notification` · `AuditLog` · `Settings`. See §8.

---

## 2. CellShoppe structure — observed

From forty-six supplied screenshots. **Every section is now covered.**

```
Home
Sales      ├ Customers · Ticket · Invoice · Quote · Web Quote
Purchase   ├ Supplier · Purchase Order · Expense · Inventory
Reports    ├ Business Overview · Summary · Profit & Loss · Sales · Expense · Inventory · Tax · Tech Performance
Marketing  ├ Call · Email · SMS · WhatsApp
Outlet     ├ Add Outlet · List Outlet
Settings   ├ Summary · Business & Organization · Financial · Users & Access Control ·
             Scheduling & Booking · Communications & Notifications · System & Audit Logs ·
             Integrations & API
```

Settings is itself a two-level section: seven **categories** in the sidebar, each opening a card
grid of **pages**, and every page reachable by a tab row as well. Full breakdown in §6.15.

### Shell conventions worth copying

1. **Full-height sidebar**, brand block pinned top, signed-in user + Sign Out pinned bottom.
2. **Collapsible groups** — one parent expanded at a time, active child highlighted with a filled bar.
3. **Quick Search (Ctrl+K)** in the sidebar *and* a search field in the top bar.
4. **Top bar**: page-title chip with back arrow · global search · `+ Create` (shortcut `C`) ·
   notification bell with unread count · user chip · density toggle · sign-out.
5. **Breadcrumb row** under the top bar — see §4b, which specifies it in full. It is the thing
   that keeps a seven-level Settings tree navigable, so it gets its own section rather than a line.
6. **Page header**: icon + H1 + one-line description on the left, primary action top-right.
7. **KPI tile row** — 3–9 tiles: uppercase micro-label with a small icon, big number, optional hint.
   Tiles carry a **coloured left border** keyed to meaning, not decoration.
8. **Filter strip**: search · segmented pill filters with counts · `Filters ▾` · `Export ▾`.
9. **Count line** above every table: `35 clients`, `Showing 1–25 of 27 tickets`, `Sales (4 invoices)`.
10. **Dense sortable table**, `···` overflow menu last column, inline status dropdowns.
11. **Empty state**: centred icon + heading + explanation + one button back to safety.
12. **Process strip** — the "PURCHASE AUTOMATION CYCLE" footer: 7 chevron-linked steps, current
    highlighted. Repeated at the bottom of every Purchase screen.
13. **Date-range control** — From/To date inputs + `Apply` + `Reset`, then a row of preset pills
    (Today · Yesterday · This Week · Last Week · This Month · Last Month · This Year · Last Year).
    Standard across every Reports tab.
14. **Sub-tab row inside a section** — Reports keeps one date range and switches content by tab,
    each tab also reachable from the sidebar. The tab row and the sidebar child list mirror each other.

---

## 2b. Colour — Cellvix theme, not CellShoppe's

**Binding.** CellShoppe's teal (`#0f6b63`) chrome does not come across. Every surface in the new
panel is built from the existing Cellvix tokens in
[`client/src/styles/index.css`](../client/src/styles/index.css). No new colour values are
introduced, and no hex is hard-coded in a component.

| Element | Token | Note |
|---|---|---|
| Sidebar background | `--color-ink-deep` `#1F1214` | The warm near-black already defined for exactly this purpose — it reads as Cellvix, not as generic black. |
| Sidebar resting item | `--color-ink-200` on `ink-deep` | Decorative-weight text is acceptable here because the contrast against `ink-deep` is high. |
| Sidebar hover | white text, `surface` at 8% overlay | — |
| Sidebar **active child** | `bg-brand-gradient` fill, white text | The gradient's licensed use: an active state. |
| Sidebar group header | `--color-ink-200`, uppercase eyebrow | — |
| Page background | `--color-surface-2` `#F7F7F9` | Matches CellShoppe's light-grey working canvas. |
| Cards / panels / tables | `--color-surface` on `--color-line` | Existing `Panel`. |
| Primary buttons | `bg-brand-gradient`, white text | `Button` already does this. |
| Top bar | `--color-surface`, `--color-line` bottom border | — |
| Breadcrumb / hint text | `--color-ink-300` | — |

**KPI tile left borders** map to the semantic tokens, never to arbitrary colour:

| Meaning | Token |
|---|---|
| Money in / positive | `--color-ok` |
| Money out / cost | `--color-warn` |
| Overdue / negative / out of stock | `--color-danger` |
| Neutral count | `--color-info` |
| Headline metric for the page | `--color-brand` |

> **The gradient stays an accent.** `bg-brand-gradient` is allowed on: the sidebar active item,
> primary CTAs, progress fills, the current step of `ProcessStrip`, and the Staff badge. It is
> **never** a page background, a card background, a table header, or a KPI tile fill.

### Other deliberate divergences

| CellShoppe | Cellvix | Why |
|---|---|---|
| Revenue tile prints `$-350.70`; a "NET LOSS" tile prints `$350.70` positive | Signed money renders once, consistently | See §9. This is a defect worth not copying. |
| "Revenue" means cash collected on one screen and invoiced total on another | Two named metrics: **Invoiced** and **Collected** | Same reason. |
| Repair statuses (Diagnosis, Ready to Pickup) | Order and RMA statuses | Different business. |
| `Web Quote` shows "Website Database Not Connected" | Dropped | Cellvix *is* the website, and quotes are admin-created for now (§0.7). |
| Tech Performance = technicians per repair ticket | **Staff Performance** = staff per order/invoice handled | No technicians in wholesale. |
| GST at 5% flat | **GST/HST by province** | Canadian conventions, and Cellvix ships nationally. |

---

## 3. Concept translation — CellShoppe → Cellvix

Sidebar position and grouping stay put; the noun changes to the wholesale equivalent.

| CellShoppe | Cellvix | Record | Notes |
|---|---|---|---|
| **Clients** (walk-in) | **Clients** (business accounts) | `User` role `buyer` | Same slot. Lifetime value, invoice count, last activity all already derivable. Approval state becomes a first-class column. |
| **Ticket** (repair job) | **RMA / Returns** | `Rma` *(new)* | Closest B2B equivalent: an item comes back, moves through states, resolves to refund / replace / reject. Keeps the "job with a status pipeline" model. |
| **Invoice** | **Invoice** | `Invoice` | Exists and is ledgered. Needs an admin list UI plus manual creation. |
| **Quote / Estimates** | **Sales Quotes** | `Quote` *(new)* | Admin-built price quote for an account: line items, expiry, accept → converts to an `Order`. |
| **Web Quote** | *(dropped)* | — | Storefront quote requests are out of scope (§0.7). Revisit later; `Quote.source` is modelled for it. |
| **Supplier** | **Supplier** | `Supplier` *(new)* | 1:1. |
| **Purchase Order** | **Purchase Order** | `PurchaseOrder` *(new)* | 1:1, automation cycle included. |
| **Expense** | **Expense** | `Expense` + `ExpenseCategory` *(new)* | 1:1, categories admin-managed. |
| **Inventory** | **Inventory** | `Product` + `StockMovement` *(new)* | `Product` already carries `sku`, `stock`, `price`. Needs `minStock`, `cost`, `location`, `supplier`. |
| **Tech Performance** | **Staff Performance** | `User` role `staff` | Orders handled, invoiced value, margin, RMAs closed. |
| **Call / Email / SMS / WhatsApp** | Same four | `MessageLog` + `Campaign` *(new)* | Log-first, same as CellShoppe: records land now, live send switches on when providers are connected. |
| **Outlet** | **Outlet** | `Outlet` *(new)* | Physical stores with their own staff (§6.14). |

### Cellvix-only sections that have no CellShoppe twin

Wholesale-native, and **not** dropped to force symmetry:

- **Approvals** — a pending business cannot see pricing or order. Lives under Sales → Clients as a
  filter *and* keeps its dashboard callout, because it is time-critical.
- **Credit & AR** — the two credit instruments (line of credit vs store credit) each need a surface.
  The Instructions are explicit that they stay apart.

---

## 4. The new shell

Replaces `AdminLayout.jsx`. Three components under `client/src/components/admin/shell/`:

```
AdminShell.jsx      full-height grid: sidebar | (topbar + breadcrumb + outlet)
AdminSidebar.jsx    brand block, quick search, ADMIN_NAV tree, user footer
AdminTopBar.jsx     title chip, search, + Create, bell, user chip, sign out
```

Shared page furniture under `client/src/components/admin/`:

```
PageHeader.jsx      icon + H1 + description + primary action
Breadcrumbs.jsx     ⌂ > Section > Page, from route metadata
KpiRow.jsx          responsive tile row with semantic left borders
DateRangeBar.jsx    From/To + Apply/Reset + preset pills, syncs to URL
FilterStrip.jsx     search + segmented pills with counts + Filters ▾ + Export ▾
DataTable.jsx       sortable dense table, row selection, ··· overflow menu
ProcessStrip.jsx    the chevron step strip for Purchase screens
CommandPalette.jsx  Ctrl+K global search / jump-to
CreateMenu.jsx      the + Create dropdown (shortcut C)
```

`DataTable` and `DateRangeBar` are the two biggest wins: fourteen planned screens are the same
table with different columns, and every Reports tab shares one date control. Build each once.

### Reuse, do not fork

`StepIndicator` already serves the tab wizard, checkout and order tracking, and the Instructions
forbid forking it. **`ProcessStrip` is a different component** — a *status display* of a
seven-stage automation cycle, not a user-advanced wizard. Separate file; it does not touch
`StepIndicator`. Flagged so a future session does not "helpfully" merge them.

Existing `Panel`, `StatTile`, `Badge`, `Modal`, `Drawer`, `Pagination`, `SelectMenu`, `Input`,
`Textarea`, `Checkbox`, `ConfirmDialog` are reused as-is.

### Charts

The dashboard and Reports need a line/area chart, a donut and horizontal bars. No charting library
is currently a dependency. **Inline SVG, hand-rolled, in `components/admin/charts/`** — three chart
shapes do not justify a dependency, and hand-rolled SVG inherits the design tokens for free. If a
later phase needs axes, brushing and stacking, revisit then.

> **Revisited 2026-09-03 — axes added, still no dependency.** The parity walk found the first version
> read as bland next to CellShoppe's, and the diagnosis was not styling: the chart had **no scale**.
> A bare line shows shape and hides magnitude — the same curve reads identically at $200 and
> $200,000, and the only number on the screen was a caption the reader had to trust.
>
> `TrendChart` now carries a **y-axis on a 1-2-5 "nice" ladder** (so ticks read `$0 · $2K · $4K`, not
> `$8,350.65`), **gridlines**, a **thinned x-axis** that always keeps the first and last label, a
> **hover crosshair with a tooltip**, and a **legend** naming the series and the average rule.
> `BarList` gained optional rank numbers and share percentages.
>
> **Three decisions inside it worth not undoing:**
>
> 1. **Zero is always on the axis.** A money chart whose baseline is $4,000 makes a 3% move look like
>    a collapse — the truncated-axis lie. `niceScale` forces zero into range.
> 2. **The area fill closes on the zero line, not the frame bottom.** With a series that dips
>    negative — which CellShoppe's own dashboard does — closing at the bottom fills the region below
>    zero solid and reads as a large positive quantity.
> 3. **Axis labels are HTML, not `<svg><text>`.** The SVG is `preserveAspectRatio="none"` so it
>    stretches to its container; text inside it stretches with it, and stretched type is the single
>    thing that makes a hand-rolled chart look broken.
>
> Still deliberately absent: brushing, zoom, stacking and a second y-axis. The moment one is genuinely
> needed, that is the point to weigh a library rather than grow this file into one.

### Route shape

`/admin` leaves the storefront `RootLayout` and mounts its own shell — the ERP is a different
application and should not carry the shop header, mega menu or footer.

```
/admin                          Dashboard
/admin/clients                  Clients          (+ ?status=pending for Approvals)
/admin/clients/:id              Client profile
/admin/rma                      RMA / Returns
/admin/rma/:id                  RMA detail
/admin/orders                   Orders
/admin/orders/:orderNumber      Order detail
/admin/invoices                 Invoices
/admin/invoices/:number         Invoice detail
/admin/quotes                   Sales quotes
/admin/quotes/:id               Quote detail
/admin/suppliers                Suppliers
/admin/suppliers/:id            Supplier profile
/admin/purchase-orders          Purchase orders
/admin/purchase-orders/:id      PO detail
/admin/expenses                 Expenses
/admin/expenses/categories      Expense categories
/admin/inventory                Inventory
/admin/inventory/:id            Product detail
/admin/reports/business         Business Overview
/admin/reports?tab=summary      Summary   (P&L · sales · expense · inventory · tax · staff · supplier-prices)
/admin/marketing/calls          Calls
/admin/marketing/email          Bulk email
/admin/marketing/sms            SMS
/admin/marketing/whatsapp       WhatsApp
/admin/marketing/referrals      Referral commission
/admin/marketing/offers         Offers    (moved)
/admin/marketing/blog           Blog      (moved)
/admin/marketing/faq            FAQ       (moved)
/admin/outlets                  List outlets
/admin/outlets/add              Add outlet
/admin/outlets/:id              Outlet detail

/admin/settings                 Settings summary
/admin/settings?cat=…           Category landing (business · financial · users ·
                                scheduling · communications · system · integrations)
/admin/settings/business-info   Business info
/admin/settings/sale            Sale settings
/admin/settings/invoice-status  Invoice statuses
/admin/settings/taxonomy        Devices, brands, models, aliases
/admin/settings/shipping        Shipping rates
/admin/settings/payment-methods Payment methods
/admin/settings/expense-categories  Expense categories
/admin/settings/inventory       Inventory defaults
/admin/settings/users           Staff accounts
/admin/settings/roles           Roles and access
/admin/settings/calendar        Calendar
/admin/settings/appointments    Appointments
/admin/settings/email           Email settings
/admin/settings/templates       Message templates
/admin/settings/activity-log    Activity log
/admin/settings/security-log    Security log
/admin/settings/api-keys        API keys
/admin/settings/third-party     Third-party apps

/admin/profile                  My profile
```

Old admin URLs (`/admin/approvals`, `/admin/products`, `/admin/customers`, `/admin/offers`,
`/admin/blog`, `/admin/faqs`) redirect to their new homes rather than 404.

> **Settings pages get real URLs, not query params.** CellShoppe mixes both — `?cat=financial`,
> `?tab=app`, and bare paths like `/admin/device-models` — so the same page is reachable three ways
> and none of them is canonical. Every Cellvix settings page gets one path; `?cat=` survives only on
> the category landing screen, which is genuinely a filtered view of the summary.

### 4b. Breadcrumbs

With Settings seven categories deep, the breadcrumb stops being decoration and becomes the primary
way back. Rules:

1. **Every admin screen has one**, directly under the top bar, above the page header. No exceptions,
   including the dashboard (`⌂ Home` alone).
2. **Built from route metadata, not the URL.** Each route declares
   `{ label, parent }`; `Breadcrumbs` walks the chain. A path segment is never parsed into a label —
   that is how you end up with `Purchase-orders` on screen.
3. **The home icon is always the first crumb** and links to `/admin`.
4. **Every crumb except the last is a link.** The last is the current page, is not a link, and is
   the only one in `--color-ink-900`; ancestors are `--color-ink-300`.
5. **Depth follows the nav tree, not history.** From `/admin/settings/api-keys` the trail reads
   `⌂ > Settings > Integrations & API > API Keys` whether the user arrived from the summary, the
   sidebar, or a link in an email.
6. **Detail pages name the record**, not the type: `⌂ > Sales > Orders > CVX-2026-00042`. The record
   identifier is the crumb — an operator scanning three open tabs needs to tell them apart.
7. **A record's crumb is truncated, never wrapped** — `max-width` with an ellipsis and a `title`.
8. **Tabs are not crumbs.** Reports tabs and Settings page tabs stay in their tab row; the trail
   shows `⌂ > Reports > Sales`, not the seven tabs beside it.
9. **Mobile (320–767) shows the last two crumbs only**, prefixed with `‹` linking to the parent.
   The full trail never wraps to a second line.
10. **`<nav aria-label="Breadcrumb">` wrapping an `<ol>`**, with `aria-current="page"` on the last
    item — it is a landmark screen readers navigate by.

Example trails:

```
⌂ Home
⌂ > Sales > Clients > Northline Wireless
⌂ > Purchase > Purchase Orders > PO-2026-00001
⌂ > Reports > Business
⌂ > Settings > Financial > Invoice Status
⌂ > Settings > Users & Access Control > Roles & Access
```

### Responsive

Not a polish pass (Instructions §3.1). Four widths, designed deliberately:

- **320–767** — sidebar becomes an off-canvas drawer behind a hamburger. Tables become stacked
  cards, one record per card. KPI tiles scroll horizontally in one row. Reports sub-tabs scroll
  horizontally. No horizontal page scroll.
- **768–1023** — sidebar collapses to a 64px icon rail with tooltips. Tables keep 3–4 priority
  columns; the rest fold into an expandable row.
- **1024–1439** — full sidebar at 220px. Tables show all columns; KPI rows wrap.
- **1440+** — sidebar 250px, content max-width 1600px, KPI row on one line where it fits.

> CellShoppe's nine-tile P&L row overflows its container even on desktop. `KpiRow` wraps to a grid
> instead of forcing one line — a tile row that clips is a bug.

---

## 5. `ADMIN_NAV` — the new tree

Lives in `shared/schemas/admin.js`, replacing the flat array:

```js
export const ADMIN_NAV = [
  { key: 'home', label: 'Home', to: '/admin', icon: 'Home' },
  {
    key: 'sales', label: 'Sales', icon: 'ShoppingBag',
    children: [
      { key: 'clients',  label: 'Clients',       to: '/admin/clients',  icon: 'Users' },
      { key: 'rma',      label: 'RMA / Returns', to: '/admin/rma',      icon: 'RotateCcw' },
      { key: 'orders',   label: 'Orders',        to: '/admin/orders',   icon: 'Package' },
      { key: 'invoices', label: 'Invoices',      to: '/admin/invoices', icon: 'FileText' },
      { key: 'quotes',   label: 'Quotes',        to: '/admin/quotes',   icon: 'FileSignature' },
    ],
  },
  {
    key: 'purchase', label: 'Purchase', icon: 'ShoppingCart',
    children: [
      { key: 'suppliers', label: 'Suppliers',       to: '/admin/suppliers',       icon: 'Truck' },
      { key: 'pos',       label: 'Purchase Orders', to: '/admin/purchase-orders', icon: 'ClipboardList' },
      { key: 'expenses',  label: 'Expenses',        to: '/admin/expenses',        icon: 'Receipt' },
      { key: 'inventory', label: 'Inventory',       to: '/admin/inventory',       icon: 'Boxes' },
    ],
  },
  {
    key: 'reports', label: 'Reports', icon: 'BarChart3',
    children: [
      { key: 'business',  label: 'Business Overview', to: '/admin/reports/business',        icon: 'LineChart' },
      { key: 'summary',   label: 'Summary',           to: '/admin/reports?tab=summary',     icon: 'PieChart' },
      { key: 'pl',        label: 'Profit & Loss',     to: '/admin/reports?tab=pl',          icon: 'Scale' },
      { key: 'r-sales',   label: 'Sales',             to: '/admin/reports?tab=sales',       icon: 'FileText' },
      { key: 'r-expense', label: 'Expense',           to: '/admin/reports?tab=expense',     icon: 'Receipt' },
      { key: 'r-inv',     label: 'Inventory',         to: '/admin/reports?tab=inventory',   icon: 'Boxes' },
      { key: 'r-tax',     label: 'Tax',               to: '/admin/reports?tab=tax',         icon: 'Percent' },
      { key: 'r-staff',   label: 'Staff Performance', to: '/admin/reports?tab=staff',       icon: 'Users' },
    ],
  },
  {
    key: 'marketing', label: 'Marketing', icon: 'Megaphone',
    children: [
      { key: 'calls',    label: 'Call',     to: '/admin/marketing/calls',    icon: 'Phone' },
      { key: 'email',    label: 'Email',    to: '/admin/marketing/email',    icon: 'Mail' },
      { key: 'sms',      label: 'SMS',      to: '/admin/marketing/sms',      icon: 'MessageSquare' },
      { key: 'whatsapp', label: 'WhatsApp', to: '/admin/marketing/whatsapp', icon: 'MessageCircle' },
      { key: 'referrals', label: 'Referrals', to: '/admin/marketing/referrals', icon: 'Gift' },
      { key: 'offers',   label: 'Offers',   to: '/admin/marketing/offers',   icon: 'Tag' },
      { key: 'blog',     label: 'Blog',     to: '/admin/marketing/blog',     icon: 'Newspaper' },
      { key: 'faq',      label: 'FAQ',      to: '/admin/marketing/faq',      icon: 'HelpCircle' },
    ],
  },
  {
    key: 'outlet', label: 'Outlet', icon: 'Store',
    children: [
      { key: 'outlet-add',  label: 'Add Outlet',  to: '/admin/outlets/add', icon: 'PlusCircle' },
      { key: 'outlet-list', label: 'List Outlet', to: '/admin/outlets',     icon: 'List' },
    ],
  },
  {
    key: 'settings', label: 'Settings', icon: 'Settings',
    children: [
      { key: 's-summary',  label: 'Summary',                     to: '/admin/settings',                     icon: 'LayoutGrid' },
      { key: 's-business', label: 'Business & Organization',     to: '/admin/settings?cat=business',        icon: 'Building2' },
      { key: 's-finance',  label: 'Financial',                   to: '/admin/settings?cat=financial',       icon: 'Coins' },
      { key: 's-users',    label: 'Users & Access Control',      to: '/admin/settings?cat=users',           icon: 'UsersRound' },
      { key: 's-sched',    label: 'Scheduling & Booking',        to: '/admin/settings?cat=scheduling',      icon: 'CalendarDays' },
      { key: 's-comms',    label: 'Communications & Notifications', to: '/admin/settings?cat=communications', icon: 'Bell' },
      { key: 's-system',   label: 'System & Audit Logs',         to: '/admin/settings?cat=system',          icon: 'ClipboardList' },
      { key: 's-api',      label: 'Integrations & API',          to: '/admin/settings?cat=integrations',    icon: 'Plug' },
    ],
  },
];
```

Badge counts (pending approvals, open RMAs, overdue invoices, low stock) come from
`GET /admin/stats` and render on the child rows, as the pending badge does today. Nav items are
**filtered by the signed-in user's permissions** (§7.6) — a staff member never sees a section they
cannot open.

---

## 6. Page specifications

### 6.1 Home — Dashboard

**Route** `/admin` · **Screenshot** 1

1. **H1 + date line** — `Thursday, August 27, 2026 · Welcome back, {contactName}`.
2. **`DateRangeBar`** — Today / 7 Days / This Month / 30 Days / This Year / Custom. URL param, so
   the view is linkable; drives every tile and chart on the page.
3. **Things to do today** — wide action cards, each with icon, title, count sentence and an arrow
   to the filtered list:
   - *Approve accounts* — `N businesses waiting for approval` → `/admin/clients?status=pending`
   - *Fulfil orders* — `N orders placed and not yet shipped` → `/admin/orders?status=placed`
   - *Restock inventory* — `N items at or below minimum` → `/admin/inventory?stock=low`
   - *Chase receivables* — `N invoices overdue` → `/admin/invoices?status=overdue`

   A card renders only when its count is non-zero. An empty board is a good day and should say so,
   not show four zeroes.
4. **KPI row — six tiles**: Collected · Invoiced · Outstanding · Open Orders · Total Clients ·
   Inventory Value. Each with a hint line; Collected carries a period-over-period delta.
   **Refunds get their own tile** — they never push a revenue figure negative (§9).
5. **Revenue trend chart** — line + area, daily buckets over the range, average reference line.
   Zero state draws a flat axis, not an empty box.
6. **Top clients** — top 5 by invoiced value in range: name, invoice count, value.
7. **Recent orders** and **Low stock** side-by-side panels.

**API** `GET /admin/stats?from=&to=` — extends the existing endpoint. Current consumers keep working
because today's shape is a subset.

---

### 6.2 Sales → Clients

**Route** `/admin/clients` · **Screenshot** 2

- **KPI row**: Total Clients · Active (with orders) · Total Invoiced · Avg Order Value.
- **Filter strip**: search (name / email / phone) · pills `All` `Pending` `Approved` `VIP` `Repeat`
  `Suspended` with counts · `Filters ▾` (province, terms, credit limit, signup date) · `Export ▾`.
- **Table**: checkbox · Client (name + email + phone stacked) · Status · Orders · Lifetime Value ·
  Last Order · Terms · Tag · `···`.
- **Row menu**: View profile · Approve / Reject · Edit credit · Allocate store credit · Suspend · Email.
- **Approvals** is this screen at `?status=pending`, with the approve/reject drawer from
  `AdminApprovalsPage.jsx` lifted in intact. The old route redirects here.

**Client profile** `/admin/clients/:id` — header (business, contact, status, account rep) then tabs:
Overview · Orders · Invoices · Quotes · RMAs · Credit (line of credit and store credit ledger, kept
visually apart per the Instructions) · Addresses · Messages · Activity.

**API** — `GET/PATCH /admin/users*` already exist. Add `GET /admin/users/:id/activity`.

---

### 6.3 Sales → RMA / Returns

**Route** `/admin/rma` · **Screenshot** 3 (structure mirrored from Tickets)

- **Status pills with counts**: `All` `Requested` `Approved` `In Transit` `Received` `Inspecting`
  `Resolved` `Rejected`.
- **Table**: RMA # (`RMA-2026-00012`) · Client · Order # · Items · Status (inline dropdown) ·
  Reason · Resolution · Age (days, warning icon past SLA) · `···`.
- **Age column** copies CellShoppe's hourglass treatment — the column that drives the day.
- **Detail** `/admin/rma/:id`: item table with per-item disposition, inspection notes, photo
  attachments, status timeline, resolution action (refund to store credit · replace · reject).

**Refunds route through `storeCreditService.js`.** Only place a store-credit balance moves; an RMA
resolution is not an exception. Restocking an accepted return writes a `StockMovement` of type
`return`.

**Answered in phase 7.** The threshold is `Settings.operations.rmaSlaDays`, **seeded at 14 days** and
read by both the list and the detail screen — not a constant, so phase 11 only builds the field that
edits it. **Age stops accruing once an RMA closes**: a return resolved in two days should not still
be shouting six months later, and a row that always shouts is a row an operator learns to ignore.

---

### 6.4 Sales → Orders

**Route** `/admin/orders` · extends `AdminOrdersPage.jsx`

- **KPI row**: Open Orders · Awaiting Fulfilment · Shipped (range) · Order Value (range).
- **Pills**: `All` `Placed` `Processing` `Shipped` `Out for Delivery` `Delivered` `Cancelled`.
- **Table**: checkbox · Order # · Client · Date · Items · Status (inline) · Payment · Total · `···`.
- **Bulk actions**: advance status, print packing slips, export.
- Existing status / tracking / refund flows kept exactly as they are — they are correct.

---

### 6.5 Sales → Invoices

**Route** `/admin/invoices` · **Screenshot** 4

- **Pills**: `All` `Unpaid` `Partially Paid` `Paid` `Overdue`.
- **Table**: checkbox · Invoice # · Client · Issued · Due · Payment status · Terms · Amount · `···`.
- **Row menu**: View · Download PDF · Record payment · Send reminder · Void.
- **Record payment** drawer: amount, date, method, reference → appends to `Invoice.payments`, then
  recomputes `amountPaid` and `status` **server-side**.

`Invoice` and `invoiceDocument.js` already exist. UI and endpoint gap, not a data gap.

**API (new)** — `GET /admin/invoices` · `GET /admin/invoices/:number` ·
`POST /admin/invoices/:number/payments` · `POST /admin/invoices` (manual) ·
`POST /admin/invoices/:number/void`.

---

### 6.6 Sales → Quotes

**Route** `/admin/quotes` · **Screenshot** 5

- **Pills**: `All` `Draft` `Sent` `Accepted` `Expired` `Converted`.
- **Table**: checkbox · Quote # (`QT-2026-00018`) · Client · Created · Expires (red when past) ·
  Amount · Status · `···`.
- **Builder**: pick client → add products by SKU search → per-line quantity and quoted unit price →
  auto subtotal / tax / total → expiry date → Send.
- **Accept → convert** creates a real `Order`. Totals recompute server-side from live products at
  conversion; the quote's stored prices are honoured only while the quote is valid, and any
  difference is surfaced to the admin before the order is written.

Admin-created only for now (§0.7). `Quote.source` is modelled as `admin | web` so a storefront
entry point is additive later.

---

### 6.7 Purchase → Suppliers

**Route** `/admin/suppliers` · **Screenshot** 7

- **Card grid** — 5 across at 1440+, 3 at 1024, 2 at 768, 1 at 320.
- **Card**: initials avatar · name · edit pencil · email · phone · Orders count · Total Spent ·
  `View profile` plus link and deactivate icon buttons.
- **Header**: `15 suppliers total` · `← Purchase Orders` · `+ Add Supplier`.
- **Profile** `/admin/suppliers/:id`: contact details, payment terms, linked products, PO history,
  spend chart, and the price history that feeds the Supplier Prices report.

---

### 6.8 Purchase → Purchase Orders

**Route** `/admin/purchase-orders` · **Screenshot** 8

- **KPI row**: Draft · Sent · Partial · Received · Pending Value.
- **Filter strip**: search PO # / supplier · status select · supplier select · `Filter`.
- **Table**: PO Number (`PO-2026-00001`) · Supplier · Order Date · Expected (red + warning icon when
  overdue) · Items · Total · Status · View.
- **`ProcessStrip`** pinned at the bottom, current stage highlighted:

  `Supplier Info → Purchase Order → Send to Supplier → Payment → Shipment → Received → Inventory`

  caption: *Fully automated — manual override possible at any step*.
- **Detail** `/admin/purchase-orders/:id`: line items with ordered and received quantities, partial
  receiving, per-unit cost, landed cost, attachments, stage actions.

**Automation contract** — receiving a PO line increments `Product.stock` and writes a
`StockMovement`. Recording a PO payment creates an `Expense` row. Both server-side; the client never
adjusts stock or money directly.

---

### 6.9 Purchase → Expenses

**Route** `/admin/expenses` · **Screenshot** 9

- **KPI row**: Total · Entries · Pending · Tax included.
- **Filter strip**: search (description / payee / reference) · category select · status select ·
  date-from · date-to · `Filter`.
- **Table**: Date · Description · Category · Payee · Method · Status · Amount · `···`.
- **Header actions**: `Categories` · `Export` · `Import` · `+ Add expense`.
- PO-generated rows are labelled `Purchase Order PO-…` and link back to the PO.
- Feeds the P&L and Expense reports.

**Categories** `/admin/expenses/categories` — admin-managed CRUD (§0.8): name, colour token,
GST-applicable flag, active. Seeded with a sensible Canadian starter set (Rent · Utilities ·
Salaries · Shipping · Software · Insurance · Professional fees · Bank charges · Marketing ·
Supplies), all editable and deletable. A category in use cannot be hard-deleted, only deactivated.

---

### 6.10 Purchase → Inventory

**Route** `/admin/inventory` · **Screenshot** 10 · extends `AdminProductsPage.jsx`

- **KPI row**: Total Items · Total Stock · Low Stock · Out of Stock · Total Value.
- **Pills**: `All` `In Stock` `Low Stock (n)` `Out of Stock (n)`.
- **Header actions**: `+ Add Product` · `Export CSV` · `Tools` (bulk price update, bulk stock
  adjust, CSV import, regenerate SKUs).
- **Table**: checkbox · Product · SKU chip · Category · Quantity (with `min: N` underneath) ·
  Status badge · Unit Price · Total Value · `···`.
- **Detail** `/admin/inventory/:id`: product fields, taxonomy, competitor benchmarks (already
  modelled), stock movement history, supplier links, price history.

**Product additions**: `minStock` · `cost` · `location` · `supplier` · `barcode`.

> **Storefront invariant** — the ERP shows exact counts and reorder points because it is admin-only.
> The **storefront still shows only in stock / out of stock**, never a count and never a shipment
> date. Adding quantities to the admin must not leak a quantity into any public payload.

---

### 6.11 Reports → Business Overview

**Route** `/admin/reports/business` · **Screenshots** 11–12

A standalone printable report, separate from the tabbed analytics screen.

- **Header actions**: `Print / Save PDF` · `← All Reports`.
- **Filters**: From · To · **Brand / Category** (Cellvix's equivalent of CellShoppe's "Device model
  (repairs)") · `Apply`. Preset pills: This Month · Last Month · This Quarter · Last 30 Days · This Year.
- **KPI row (5)**: Invoiced · Expenses · Net Profit · Units Purchased (with spend hint) · Units Sold.
- **Income by Payment Method** — donut, legend to the right.
- **Top Categories by Invoiced Value** — horizontal bars. *(CellShoppe: Top Services by Revenue.)*
- **Sales per Category** — table: Category · Times Sold · Value, with a Total row.
- **Units Bought** — table: Item · Units · Spend. Caption: *Counts stock received from purchase
  orders in the period.* Empty state: *No stock received in this period.*
- **Units Sold** — items shipped in the period by part type, with sub-tiles for the top two
  categories.
- **GST/HST Summary** — three tiles: Collected (income) · Paid (expenses) · Owed to tax authority,
  with the arithmetic printed underneath.
- **Sales by Brand / Model** — the wholesale read of CellShoppe's "Repairs by Model".

**Print** is a real requirement: a `@media print` stylesheet that drops the sidebar, top bar and
action buttons, and forces the light palette regardless of theme.

---

### 6.12 Reports → tabbed analytics

**Route** `/admin/reports?tab=…` · **Screenshots** 13–20

One `DateRangeBar` at the top (From · To · `Apply` · `Reset`, then Today · Yesterday · This Week ·
Last Week · This Month · Last Month · This Year · Last Year), one `Export CSV`, and a sub-tab row.
Each tab is also a sidebar child. **Tab and date range both live in the URL** so any view is a link.

**`?tab=summary`** — KPI row of 7: Invoiced · Collected · Gross Profit · Cost of Goods · Expenses ·
GST/HST Collected · Outstanding. Then:
- *Staff Performance* panel — table: Staff · Orders · Invoiced · Margin · RMAs closed.
- *Outstanding* panel — Total Outstanding · Overdue Amount · Total Invoices · Overdue Count, plus
  the top unpaid invoices with a `View all →`.
- *Profit & Loss* summary with a `Details →` to the P&L tab.
- *Inventory* summary — Total Items · Stock Value · Out of Stock · Low Stock, plus a **Stock Alerts**
  list (`Low Stock · N left` per item).

**`?tab=pl`** — KPI row: Product Revenue · Shipping Revenue · Net Revenue · Cost of Goods ·
Gross Profit · Expenses · Net Profit · Collected. Then a **P&L Statement** in accounting order
(Revenue → Cost of Goods → Gross Profit → Operating Expenses → Net Profit → Tax collected →
Discounts given) and a **By Category** breakdown table (Category · Orders · Revenue · Cost · Margin).

**`?tab=sales`** — KPI row: Invoices · Total · Paid · Unpaid · Partial. Then:
- *Collected in period (by payment date)* — with CellShoppe's clarifying caption kept, because it is
  genuinely useful: the cards above are **invoiced** totals by invoice date; this is money actually
  **collected** in the range.
- *Income by payment method* — table: Method · Count · Amount.
- *Sales* table — Invoice # · Customer · Date · Type · Status · Total · View.
- *Due & Overdue* — four tiles, then an **Unpaid & Overdue Invoices** table with a Balance column.

**`?tab=expense`** — KPI row: Total Spent · Entries · GST/HST Paid. Then *By Category* and *By
Payment Method* panels, and the expense table. Empty states read *No expenses in this period.*

**`?tab=inventory`** — KPI row: Total Items · Stock Value · In Stock · Low Stock · Out of Stock.
Then *All Stock Items* (Product + SKU · Category · Qty · Min · Unit Cost · Value · Status) and
*Period Movement* fed by `StockMovement` (empty state: *No transactions this period.*).

**`?tab=tax`** — three headline tiles: GST/HST Collected (income) · GST/HST Paid (expenses) ·
Net payable to tax authority, with the note that a negative value means a refund/credit is due.
Second row: Invoices · Subtotal · Discounts · Shipping · Tax Collected · Gross Revenue. Then a
**GST/HST Register** (Invoice · Date · Customer · Subtotal · Shipping · Discount · Rate · Tax ·
Total, with a Totals row) and a **By Province** table (Province · Count · Tax · Avg Rate).

> **Divergence:** CellShoppe applies a flat 5% GST. Cellvix ships across Canada, so the register
> carries a **per-province rate** and the By Province table is a primary output, not a footnote.
> Rates live in Settings, not in code.

**`?tab=staff`** — KPI row: Total Invoiced · Total Invoices · Orders Closed · Active Staff. Then a
*Contribution* panel (per-staff bar with invoices, average, margin %, closed count, avg turnaround)
and a *Detailed Breakdown* table with its own `Export CSV`.

**`?tab=supplier-prices`** — **Supplier Price Comparison.** Caption: *What each supplier charged per
item (from purchase orders). Cheapest is highlighted — use it to decide who to buy from.*

Table: Item · Supplier (with a `CHEAPEST` chip on the winning row) · Lowest · Avg · Highest ·
Times · Last purchased. The cheapest row is tinted with `--color-ok-50`.

Sourced entirely from `PurchaseOrder` line items — no separate price list to maintain, which is why
this tab only becomes useful once phase 5 has real POs in it. One row per item/supplier pair.

**API (new)** — `GET /admin/reports/:tab?from=&to=` returning aggregates only. Reports are read-only
and must never mutate.

---

### 6.13 Marketing

**Routes** `/admin/marketing/*` · **Screenshots** 21–24

Four communication screens plus the three re-homed content editors.

**Shared notice**, kept verbatim in spirit from CellShoppe: *Messages are logged here now. Live send
and receive switches on once those APIs are connected.* Log-first is the right call — the operator
gets a complete contact history immediately, and provider wiring is additive.

**Call** `/admin/marketing/calls` — two-column: *Log a call* form (Customer select · Direction
inbound/outbound · Recording URL optional · Notes · `Log Call`) beside a *History* panel.

**SMS** `/admin/marketing/sms` and **WhatsApp** `/admin/marketing/whatsapp` — identical shape:
Customer select · Message textarea · Send, beside History. Same `MessageLog` model, different
`channel`.

**Email** `/admin/marketing/email` — bulk campaigns, a heavier screen: header actions `Templates` ·
`Unsubscribes` · `+ New Campaign`; campaign list with status, audience size, sent/opened/clicked;
empty state *No campaigns yet* with a create button.

> **Compliance is not optional.** Canadian anti-spam law (CASL) requires consent, a working
> unsubscribe and sender identification on commercial email. `User` gains a `marketingConsent`
> record (source, timestamp, IP) and campaigns exclude non-consenting and unsubscribed recipients
> **server-side**. The `Unsubscribes` screen exists because the law requires it, not because
> CellShoppe has one.

**Offers / Blog / FAQ** — `AdminOffersPage.jsx`, `AdminBlogPage.jsx`, `AdminFaqPage.jsx` moved here
unchanged. They still render to the storefront through `lib/richText.jsx`, and still never use
`dangerouslySetInnerHTML`.

#### Referral commission — approved 2026-08-27

**Route** `/admin/marketing/referrals`

A referring business earns a percentage of every payment its referred accounts make, credited as
**store credit**. Approved for build; this is the spec.

- **Screen**: commission rate control at the top (`%` + `Save rate`, stored in
  `Settings.financial.referralPercent`), three tiles (Active referrers · Credit issued this period ·
  Pending), then a table: Referrer · Referred account · Joined · Payments counted · Commission
  earned · Last payout · `···`.
- **Attribution**: `User.referredBy` → `User`, captured at registration from a referral code on the
  referrer's account (`User.referralCode`, generated on approval). Set once, at signup, and
  **never editable afterwards** — a retroactively changed referrer is a way to move money.
- **Earning**: a commission accrues when a referred account's **payment is recorded**, not when an
  order is placed. An unpaid invoice has earned nobody anything.
- **Paying**: the accrual writes a `CreditTransaction` of a new type **`referral`** through
  `storeCreditService.js`. That service is the only place a store-credit balance moves
  (Instructions), and this is not an exception — it gets a `creditReferral()` function rather than
  its own write path.
- **Reversal**: if the payment is later refunded or the invoice voided, the commission is reversed
  with an offsetting `referral` entry. Commission on money that came back is money leaking out.

**Guards, because this pays real money on an automatic trigger:**

- **Self-referral is rejected** at registration — an account cannot be its own referrer, directly
  or through a cycle.
- **One level only.** No multi-level chain: a referrer earns on their own referrals, never on their
  referrals' referrals.
- **Rate changes are not retroactive.** Each accrual snapshots the rate in force when it was
  earned, the way order lines snapshot price.
- The whole feature is **admin-only and audit-logged**, rate changes included.

New fields: `User.referralCode` · `User.referredBy` · `Settings.financial.referralPercent`.
`CREDIT_TYPES` in [`server/src/models/CreditTransaction.js`](../server/src/models/CreditTransaction.js)
gains `referral` alongside the existing `refund` / `recharge` / `grant` / `adjustment` / `redemption`.

Storefront side — showing a buyer their referral code and earnings in `/account` — is **not in this
build**. The admin surface comes first; the buyer-facing half is a later decision.

---

### 6.14 Outlet

**Routes** `/admin/outlets`, `/admin/outlets/add` · **Screenshots** 25–26

**Physical stores, each with its own staff** (§0.5).

**List** `/admin/outlets` — H1 with a `Live` badge, subtitle *Each shop has its own colour identity,
so you build muscle memory across the list*, `+ Add outlet` top-right. Then a four-figure summary
strip (Total · Active · Inactive · Maintenance), a search field, and a **Cards / Table** view
toggle. Cards carry a coloured top border, store icon, name, `#000001` code, status dot, a
`YOU'RE HERE` chip on the current outlet, address, phone, email, manager, and edit / delete /
`View details →` actions.

**Add / edit** `/admin/outlets/add` — form on the left, **live preview card** on the right showing
how the outlet will appear in the list. Sections: *Identity* (name, auto-suggested next code,
status Active / Inactive / Maintenance) · *Contact & location* (street, line 2, city, province,
postal, country, phone, email) · *Management* (manager, staff assignment) · *Hours*.

**Cellvix adaptations:**
- Province is a **select of Canadian provinces and territories**, not a free-text field, and postal
  code validates `A1A 1A1` — both already exist in `shared/business.js`.
- Colour identity draws from a **fixed token-derived palette**, not arbitrary hex, so outlet colours
  stay inside the design system.
- **Staff are assigned to an outlet.** `User.outlet` scopes what a staff member sees; the admin sees
  everything, with an all-outlets/one-outlet switcher in the top bar.
- Cellvix runs **one location today** (§0.9). The model and the outlet switcher ship now; per-outlet
  stock does **not**. `StockMovement` carries an `outlet` field from day one so splitting stock later
  is a backfill, not a migration.

---

### 6.15 Settings

**Routes** `/admin/settings*` · **Screenshots** 28–48

The largest section, and the only one that is itself two levels deep. Seven categories, each holding
one to seven pages.

**Summary** `/admin/settings` — the landing screen. H1 *Summary*, subtitle *Everything to configure
your shop, grouped by area.* Then one panel per category, each holding a card grid of its pages.
Every card is `Title` + a grey one-line description of what lives inside. This screen is the map,
and it is worth keeping: with ~20 settings pages, a flat list would be unusable.

**Category landing** `/admin/settings?cat=…` — H1 = category name, subtitle *Settings for this
area.*, a tab row (`← Summary` then one tab per page), and the same card grid filtered to that
category. Cellvix keeps this pattern: it means every page is reachable in two clicks from anywhere.

#### The seven categories

**1 · Business & Organization** — one page.
- *Business Info* — company name, tagline, phone, email, website, GST/HST number, address, logo
  upload. Feeds invoices, emails and the storefront footer.
  **Replaces the `BUSINESS_INFO` placeholder constants in `client/src/lib/constants.js`** — this is
  the answer to open question 1 on the PROGRESS board, and the storefront should read from here
  once it exists.

**2 · Financial** — seven pages, the densest category.
- *Sale Settings* — Application & Regional (app name, timezone, currency symbol) · Invoice &
  Numbering (default tax rate, default payment due days, `Manage Invoice Status`) · Warranty by tier ·
  Payment Rate · Services.
  **Cellvix changes:** timezone defaults to America/Edmonton, currency is fixed CAD; the flat
  "Default GST Rate" becomes a **per-province GST/HST table** (§9.5); "Warranty by membership tier"
  becomes **warranty by product grade** (`NEW` / `OEM` / `PULL-A` / `PULL-B` / `AFTERMARKET`), which
  is the axis wholesale actually warranties on; the per-km mileage rate is **dropped** — no mobile
  jobs — and replaced by **shipping rate bands** (flat rate, free-over threshold, per-province
  surcharge), which checkout needs and currently hard-codes.
- *Invoice Status* — automatic, time-lapse invoice statuses. Each fires **once per invoice** when
  its delay elapses, on the customer's chosen channel, via a daily cron pass. Editor per status:
  Label · Send after N days after `<event>` · Channel · Email subject · Message with
  `{{customer_name}}` `{{shop_name}}` `{{invoice_number}}` `{{amount}}` `{{status}}` placeholders ·
  Active checkbox. Built-in statuses are marked `BUILT-IN` and cannot be deleted; custom ones can.
  A banner states plainly which channels are live and which are stubbed.
- *Device & Models* → **Taxonomy** for Cellvix. Master list behind the searchable picker on quote,
  order and product forms. KPI row (Total · Active · Inactive · Brands), search, category filter,
  `Show inactive`, `Import CSV`, `+ Add Model`. Table: Category · Brand · Device · Model · Aliases ·
  Status · `···`. **Aliases are the valuable part** — `15 PM`, `iphone15pm` all resolving to one
  model is exactly what a wholesale search box needs, and Cellvix already has `searchTerms` on
  `Product` to build on. Backs the existing `Taxonomy` model.
- *Services* → **dropped.** Cellvix sells parts, not labour. Its slot in the tab row is taken by
  *Shipping Rates*.
- *Discount Codes* → **folds into Marketing → Offers.** `pricingService.js` is the only place a
  discount is decided (Instructions), and `Offer` already models codes, percent/flat, expiry, usage
  limits and single-use. A second discount system here would violate that rule outright.
  The **Referral Commission** control at the top of CellShoppe's screen is a genuinely new feature,
  **approved 2026-08-27** and specified in §6.13. It lives under Marketing → Referrals, not here,
  because it pays store credit rather than discounting a price.
- *Payment Methods* — flat editable list of Method + code, add and delete. Seeded with Cash, Debit,
  Credit Card, e-Transfer, Cheque, Bank Transfer, PayPal, Other. Used by expenses and payments.
- *Expense Categories* — two-column: list (Category with icon and colour · Used by N expenses ·
  edit · delete) beside an *Add category* form (Name · Colour · Icon). This is §6.9's Categories
  screen; it lives here, and `/admin/expenses/categories` redirects to it. A category in use cannot
  be hard-deleted — the `Used by` count is what makes that legible.
- *Inventory Settings* — Default Pricing (default markup %, default margin %, with the conversion
  printed: `markup = margin ÷ (100 − margin) × 100`) · General Categories (categories needing no
  device/model) · Groups & Sub-groups. Pre-fills the New Product form; per-product override always
  wins.

**3 · Users & Access Control** — two pages. This is §7.6 made concrete, and the screenshots change
the design: CellShoppe has **named roles**, not a per-user permission map.
- *Users* — KPI row (Total · Active · Inactive · Admins · Staff · Locked), search, role filter,
  table (Name with a `You` chip · Email · Role · Status · Last login · `···`), `Add User`.
- *Roles & Access* — a card per role showing its per-area access as chips, plus an
  *Add a new role* form: Role Name, then one `No access / Read only / Full` select per area.
  `Admin` is `FULL ACCESS`, is not editable, and always wins.
  CellShoppe ships three built-in roles; Cellvix's wholesale equivalents:
  **Account Manager** (Clients Full · Sales Full · Purchase Read · Reports Full · Marketing Full ·
  Outlet Read · Settings None) · **Warehouse** (Clients Read · Sales Read · Purchase Full ·
  Reports Read · Outlet Read) · **Front Desk** (Clients Full · Sales Full · Purchase Read ·
  everything else None).

  > **Correction to §7.6.** That section proposed a permission map stored per user. The screenshots
  > show CellShoppe assigns a **named role**, and the role carries the map. That is the better
  > model — it is what the operator already knows, and changing one role updates everyone on it.
  > §7.6 has been rewritten to match; `User.permissions` is replaced by `User.role → Role.areas`.

**4 · Scheduling & Booking** — two pages: *Calendar* (weekly board, filter by staff, colour-coded
statuses, unscheduled-jobs tray, optional Google Calendar sync) and *Appointments* (time-grid
booking, `Book Appointment`).

> **UI only for now — see §6b, U1 and U2.** Settled 2026-08-27: build the interface, wire it later.
> Both screens render with their real chrome — weekly navigation, staff filter, status legend,
> unscheduled tray, time grid, `Book Appointment` — reading from `Appointment`, which ships empty.
> Neither screen writes yet, and each carries the standard inactive notice.
>
> The intended repurpose, when it is wired: a wholesaler has no repair calendar, but it does have
> **pickups, deliveries and RMA drop-offs**, and the same weekly board serves them. The
> unscheduled-jobs tray becomes unscheduled **RMAs and local deliveries**; scoped to outlets once
> there is more than one. Confirm that reading before wiring — it is the one thing here still
> assumed rather than settled.

**5 · Communications & Notifications** — two pages.
- *Email Settings* — Automatic Emails, a list of labelled toggles: auto-send invoice on creation ·
  auto-send quote on creation · auto-send payment confirmation · auto-send payment status updates ·
  enable invoice reminders · enable low-stock alerts. Then Reminders & Notifications: days before
  due to send a reminder · days after due to follow up · admin notification email · notify admin
  when a payment exceeds `$N` · low-stock alert email.
  Each toggle carries a full sentence explaining what it does — worth copying exactly. CellShoppe
  ships them all **off by default**, which is the right call for anything that emails a customer.
  **Cellvix adds**: auto-send on account approval and rejection, which is already a live email path.
- *Templates / Notifications* — one message per **status**, per notification type. Channel tabs
  (Call · SMS · WhatsApp · Email, each with a count), a Document select, a Status select plus status
  pills, then the message editor with placeholders and an Active checkbox. Documents for Cellvix:
  Order · Invoice · Quote · RMA. Call templates are a **script for staff to read**, not a sent
  message — a nice touch, kept.

**6 · System & Audit Logs** — two pages, and the UI for §7.5.
- *Activity Log* — search, then Time · User · Action (as a chip) · Entity · Description · IP.
- *Security Log* — an **admin-only** banner, then Time · Event · User · IP · Details. Login
  successes and failures, CSRF failures, lockouts.
  Both are read-only, both paginate, neither is ever deletable from the UI. Backed by `AuditLog`.

**7 · Integrations & API** — two pages.
- *API Keys* — per-provider cards, each with a `NOT SET` / `CONFIGURED` chip and masked fields with
  a reveal toggle: WhatsApp Business API · SMS (Twilio) · Google Maps/Places · email provider.
  **Cellvix adds a payment gateway card** (the mock gateway stays until real keys land).
- *Third-Party Apps* — ready-made OAuth connections (Google Contacts, Google Calendar) with
  `Connect` buttons and setup guidance when server-side credentials are missing.

> **Security, and this is not negotiable.** Secrets are **write-only through the API**: the server
> stores them encrypted at rest, returns a masked preview and a boolean `configured`, and **never
> returns a stored secret to the client** — not even to an admin, not even masked-then-revealed.
> The reveal toggle in CellShoppe's UI unmasks *what the admin just typed*, nothing more. Keys are
> settable only by `admin`, never by a role, and every write is audit-logged with the actor and IP
> but never the value.

#### Two more screens the top bar needs

- **My Profile** `/admin/profile` — avatar, name, role chip, email, status, member since, last
  login, `Edit`, `Manage Users`, `Sign Out`. Reached from the user chip.
- **Notifications dropdown** — panel under the bell: `Clear All`, `N alerts`, and a scrolling list
  of icon + type + one-line detail + relative time, each row tinted by severity
  (`danger` for out of stock, `warn` for low stock). Rows link to the entity. Backs §7.3.

#### The `+ Create` menu, confirmed

The screenshot settles §7.2's shape — it is **grouped**, not a flat list:

```
INCOME    Customer · Ticket · Invoice · Quote
EXPENSE   Supplier · Purchase Order · Expense · Inventory
```

Cellvix: **INCOME** — Client · Order · Invoice · Quote · RMA ·
**EXPENSE** — Supplier · Purchase Order · Expense · Product.

---

## 6b. UI-only surfaces — the finish-later register

Settled 2026-08-27: several screens ship as **interface without live wiring**, to be completed once
the business answers or provider keys arrive. This section is the **single tracked list**. Anything
built UI-only goes here; nothing else is allowed to be.

> **Why this section exists.** A half-wired screen that looks finished is worse than a missing one —
> somebody will type a real WhatsApp message into a box that silently drops it. Every entry below
> carries an explicit rule for what the UI must do instead of pretending.

### The register

| # | Surface | Route | Ships | Deferred | Unblocked by |
|---|---|---|---|---|---|
| U1 | **Calendar** | `/admin/settings/calendar` | ✅ **shipped, phase 11e** — weekly board, staff filter, status legend, unscheduled tray, navigation, reading a real (empty) `Appointment` | Scheduling writes; Google Calendar sync | Settled 2026-08-28: build UI now, wire later. Phase 13 |
| U2 | **Appointments** | `/admin/settings/appointments` | ✅ **shipped, phase 11e** — day time-grid, disabled `Book Appointment`. **There is no write route at all** (POST 404s), not a disabled handler | Booking persistence, slot rules, conflict checks | Same as U1 |
| U3 | **SMS** | `/admin/marketing/sms` | ✅ **shipped, phase 9** — compose form, history list, template picker; every message stored `queued_unconfigured` with the reason shown | Live send (Twilio) | Twilio credentials |
| U4 | **WhatsApp** | `/admin/marketing/whatsapp` | ✅ **shipped, phase 9** — same screen as U3, different channel | Live send (WhatsApp Business API) | Provider keys |
| U5 | **Calls** | `/admin/marketing/calls` | ✅ **shipped, phase 9** — log-a-call form with direction and recording URL, history. Logs rather than sends, so it carries no provider notice | Click-to-dial, recording fetch, AI analysis | Telephony provider |
| U6 | **Bulk Email** | `/admin/marketing/email` | ✅ **shipped and fully wired, phase 9 — off this register.** `mailer.js` has a transport, so it genuinely sends; CASL consent and unsubscribe are enforced server-side | — | — |
| U7 | **Third-Party Apps** | `/admin/settings/third-party` | ✅ **shipped, phase 11c** — connection cards, status chips, disabled `Connect`, and setup steps for the Google Cloud console | Google OAuth round-trip | Google Cloud client credentials |
| U8 | **Staff Performance** | `/admin/reports?tab=staff` | The tab, its notice, and the whole-business totals that are genuinely known (invoiced, invoices, orders) | Per-staff attribution, contribution bars, turnaround, the detailed breakdown | Phase 8 — `Role`, staff accounts and order attribution |

> **U8 is unblocked by our own build order, not by a client answer or a provider key** — which makes
> it the one entry on this register that clears itself. It is listed anyway: invariant 17 says every
> UI-only surface is tracked here, and "we know when it lands" is not an exemption.

**Not on this register, and deliberately so:** *Invoice Status* rules and *Message Templates* are
**fully functional on the email channel from day one** — email already works in this codebase. Only
their SMS and WhatsApp channels are stubbed, and the screen says so inline.

> **Phase 11c changed what U3 and U4 are waiting on, and it is worth being precise.** Twilio and
> WhatsApp credentials can now be **stored** on the API Keys screen — so the blocker is no longer
> "nobody has the keys", it is that **no client transmits through them**. That distinction is carried
> in the data: `channelStatus` returns `configured` (credentials present) *and* `delivers` (a message
> actually leaves), and the screens' notice keys on `delivers`. Saving keys changes the notice's
> wording; it does not remove it, and it does not make anything send. Phase 13 writes the client.

### Rules every UI-only surface obeys

1. **It never silently swallows input.** A compose form on an unconfigured channel saves a
   `MessageLog` row with `status: 'queued_unconfigured'` and tells the user plainly: *Saved to
   history. Live sending switches on when the provider is connected.* CellShoppe's own banner does
   exactly this, and it is the right pattern.
2. **A persistent notice at the top of the screen**, in the `warn` token, naming what is inactive
   and what unblocks it. Not a tooltip, not a disabled-button title.
3. **Real data model from day one.** `MessageLog`, `Appointment` and `Campaign` are built and
   written to now. Turning a channel on later is a service swap, not a migration.
4. **No fake success.** Nothing reports "Sent" that was not sent. The status vocabulary carries
   `queued_unconfigured` precisely so the history list can be honest.
5. **Seeded dummy values are labelled as dummy.** Warranty lengths, tax rates and business details
   ship with defaults; each field carries a hint that it is a placeholder pending real figures.
6. **Every entry links back here.** The section spec says "UI-only — see §6b, U3", so a future
   session cannot mistake an unwired screen for a broken one.

### Dummy data shipped, pending real values

| What | Where | Placeholder | Replace when |
|---|---|---|---|
| Warranty by grade | `Settings.financial.warrantyByGrade` | `NEW 365` · `OEM 180` · `PULL-A 90` · `PULL-B 60` · `AFTERMARKET 90` days | Client confirms |
| GST/HST by province | `Settings.financial.taxRatesByProvince` | Standard 2026 rates (§9.5) | Client confirms; also confirm reseller exemption |
| Business info | `Settings.business` | Current `BUSINESS_INFO` placeholders from `lib/constants.js` | Client provides |
| Outlet | `Outlet` collection | One record, Cellvix's single location | A second location opens |

Each of these is **editable in Settings on day one**, so replacing a placeholder is a form edit, not
a deploy.

---

## 7. Cross-cutting features

### 7.1 Global search (Ctrl+K)

`GET /admin/search?q=` returns grouped hits: clients, orders, invoices, quotes, RMAs, products,
suppliers, POs, outlets. Arrow keys navigate, Enter opens, recent searches persist in
`localStorage`. Results are **permission-filtered** server-side.

### 7.2 `+ Create` menu (shortcut `C`)

**Grouped**, per the screenshot (§6.15):

```
INCOME    Client · Order · Invoice · Quote · RMA
EXPENSE   Supplier · Purchase Order · Expense · Product
```

Entries the user's role cannot reach are hidden — and the underlying route still checks, because a
hidden menu item is not a permission (§7.6).

### 7.3 Notifications

Bell with unread count, opening the dropdown specified in §6.15: `Clear All`, `N alerts`, then rows
of icon + type + one-line detail + relative time, tinted by severity and linking to the entity.

Sources: new registration · new order · new quote accepted · new RMA · invoice overdue · low stock ·
out of stock · PO overdue. `Notification` model with per-admin read state; polled on an interval to
start, upgraded to SSE only if that proves necessary.

**Built in 12c, and the eight sources split into two kinds.** The first four are *events* — they
happened at an instant and stay true — and are stored rows. The last four are *standing conditions*:
they are true right now and stop being true when the invoice is paid or the shelf is restocked. Those
are **derived from the live records on every read and never stored**, because a stored row for a
condition that has cleared is a panel telling an operator to chase money that already arrived. Read
state and `Clear All` are per admin — one event is seen separately by each of several staff, so a
shared boolean would let the first reader silence it for everyone — and clearing writes a
dismissal rather than deleting anybody else's row.

Notifications are **role-filtered**: a warehouse role sees stock and PO alerts, not overdue
invoices.

### 7.4 Export

`Export ▾` on every list and report: CSV and XLSX, honouring the **current filter set and date
range**, generated server-side. An export that ignores active filters is a bug, not a shortcut.

### 7.5 Audit trail

Every admin mutation writes an `AuditLog` entry: actor, action, entity, before/after, timestamp, IP.
Money and stock both move through this panel, and multiple staff now touch it, so "who changed this"
must be answerable.

### 7.6 Roles and permissions

Settled (§0.6): **one admin role with full power**, plus staff with admin-selected permissions.

**Revised after the Settings screenshots.** The first draft of this section stored a permission map
on each user. CellShoppe instead assigns a **named role**, and the role carries the map — which is
better: the operator already thinks in job titles, and editing one role updates everyone holding it.

```
Role                                   // admin-editable, seeded with built-ins
  name, slug, isBuiltIn, isSystem      // isSystem = the Admin role, never editable
  areas: { [area]: 'none' | 'view' | 'full' }

User.role: 'buyer' | 'staff' | 'admin' // account type
User.staffRole: ObjectId | null        // → Role, required when role === 'staff'
User.outlet: ObjectId | null           // staff are scoped to one outlet
```

Areas are the top-level nav groups, matching the Roles & Access screen: `clients` `sales`
`purchase` `reports` `marketing` `outlet` `settings`. Group-level, not page-level — a per-page
matrix would be twenty rows nobody maintains correctly.

Rules:
- **`admin` bypasses the role system entirely** — full power, always, and its Role row is
  `isSystem` and not editable in the UI.
- A `staff` user without a `staffRole` has **no admin access at all**. Access is granted, never
  inherited.
- **Enforced server-side** by `requirePermission(area, level)` middleware. The nav filter, hidden
  `+ Create` entries and disabled buttons are a courtesy, never the control.
- `view` is genuinely read-only: it must not reach any mutating route, including exports that write
  an audit row.
- **Money-moving actions require `full`** on their area *and* are always audit-logged with actor
  and IP: credit allocation, refunds, invoice void, PO payment, RMA resolution.
- **Some things are admin-only regardless of role**, because a role that can grant itself power is
  not a permission system: editing roles, creating users, API keys, and the security log.
- Existing `admin` accounts map to the new `admin` role unchanged. Additive migration.

Built-in roles seeded for Cellvix (all editable except Admin):

| Role | Clients | Sales | Purchase | Reports | Marketing | Outlet | Settings |
|---|---|---|---|---|---|---|---|
| **Admin** | full | full | full | full | full | full | full |
| **Account Manager** | full | full | view | full | full | view | none |
| **Warehouse** | view | view | full | view | none | view | none |
| **Front Desk** | full | full | view | none | none | view | none |

---

## 8. New models

All money in **integer cents**. All totals recomputed server-side. No exceptions.

```
Supplier        name, code, email, phone, contactName, address, paymentTerms,
                website, notes, isActive, ordersCount, totalSpent

PurchaseOrder   poNumber, supplier, outlet,
                status(draft|sent|partial|received|cancelled),
                orderDate, expectedDate, receivedDate,
                items[{ product, sku, name, qtyOrdered, qtyReceived, unitCost, lineTotal }],
                subtotal, tax, shipping, total,
                payment{ status, method, reference, paidAt, expense },
                attachments[], timeline[], notes, createdBy

Expense         date, description, category, payee, method,
                status(pending|paid), amount, tax, taxIncluded,
                reference, purchaseOrder, outlet, attachment, notes, createdBy

ExpenseCategory name, slug, colorToken, gstApplicable, isActive, order

Quote           quoteNumber, user, source(admin|web),
                status(draft|sent|accepted|expired|converted|rejected),
                items[{ product, sku, name, qty, unitPrice, lineTotal }],
                subtotal, tax, shipping, total, validUntil, notes,
                convertedOrder, timeline[], createdBy

Rma             rmaNumber, user, order,
                status(requested|approved|in_transit|received|inspecting|resolved|rejected),
                items[{ product, sku, name, qty, reason, condition, disposition }],
                reason, resolution(refund|replace|reject|pending), refundAmount,
                creditTransaction, inspectionNotes, attachments[], timeline[], createdBy

StockMovement   product, outlet, type(purchase|sale|adjustment|return|damage|transfer),
                qtyChange, qtyAfter, unitCost, reference{ kind, id, label },
                note, createdBy, createdAt

Outlet          name, code, status(active|inactive|maintenance), colorToken,
                address{ street, line2, city, region, postal, country },
                phone, email, manager, staff[], hours, isDefault, notes

MessageLog      channel(call|sms|whatsapp|email), direction(inbound|outbound),
                user, staff, body, recordingUrl, campaign, provider, providerRef, createdAt
                status(logged|queued_unconfigured|sent|delivered|failed)
                // queued_unconfigured = saved, provider not connected yet (§6b)

Campaign        name, subject, body, template, audience{ filter, count },
                status(draft|scheduled|sending|sent|failed), scheduledAt, sentAt,
                stats{ sent, delivered, opened, clicked, bounced, unsubscribed }, createdBy

Notification    type, title, body, entity{ kind, id }, severity, readBy[], createdAt

AuditLog        actor, action, entity{ kind, id }, before, after, ip, createdAt
                kind: 'activity' | 'security'   // the two log screens, one collection

Role            name, slug, isBuiltIn, isSystem,
                areas: { clients, sales, purchase, reports, marketing, outlet, settings }
                       each 'none' | 'view' | 'full'

PaymentMethod   name, code, isActive, order

InvoiceStatusRule  label, isBuiltIn, isActive, delayDays,
                   trigger('invoice_paid'|'invoice_created'|'invoice_overdue'),
                   channel('email'|'sms'|'whatsapp'), subject, message, lastRunAt

MessageTemplate  channel(call|sms|whatsapp|email), document(order|invoice|quote|rma),
                 status, subject, body, isActive

Appointment     type(pickup|delivery|rma_dropoff), user, outlet, staff,
                startsAt, endsAt, status, reference{ kind, id }, notes

Settings        singleton, grouped to match the seven Settings categories:
                business{ name, tagline, phone, email, website, taxNumber, address, logo }
                financial{ timezone, currency, taxRatesByProvince[], defaultDueDays,
                           warrantyByGrade{}, shippingRates{}, defaultMarkup, defaultMargin,
                           generalCategories[], groups[], referralPercent }
                communications{ autoSend{...toggles}, reminderDaysBefore, followUpDaysAfter,
                                adminEmail, paymentAlertThreshold, lowStockEmail }
                operations{ rmaSlaDays }
                providers{ whatsapp, twilio, googleMaps, email, payment }  // secrets encrypted
```

Numbering follows the existing `CVX-2026-00042` / `INV-2026-00042` convention:
`PO-2026-00001` · `QT-2026-00001` · `RMA-2026-00001` · `EXP-2026-00001`. Outlets use the
zero-padded `#000001` form CellShoppe uses.

**`User` additions**: `role` widened to include `staff` · `staffRole` → `Role` · `outlet` ·
`marketingConsent{ granted, source, at, ip }` · `unsubscribedAt` · `referralCode` ·
`referredBy` → `User` (set once at signup, never editable).

**`CreditTransaction` change**: `CREDIT_TYPES` gains **`referral`** — see §6.13. Referral
commission is written by `storeCreditService.creditReferral()`, never by hand.

**`Settings.providers` is encrypted at rest and write-only through the API** — reads return
`{ configured: true, preview: '••••1234' }` and never the value (§6.15).

---

## 9. Money and metrics — the rules

CellShoppe's reports print `REVENUE $-350.70` beside `NET LOSS $350.70`, and use "Revenue" to mean
cash collected on one screen and invoiced total on another. Both are copied here as **anti-patterns**.

1. **Two named metrics, never one word.** **Invoiced** = value of invoices issued in range, by
   invoice date. **Collected** = payments received in range, by payment date. Every tile says which.
2. **Refunds are their own line**, never a negative pushed into a revenue figure.
3. **A signed figure renders once.** A loss shows as `Net profit −$350.70` in the danger token, not
   as a positive number under a "Net loss" label.
4. **Cost of goods comes from `Product.cost`** captured at order time, so margin survives later price
   changes. Order lines snapshot cost the way they already snapshot price.
5. **Tax is computed per province** from the Settings table, never a hard-coded rate.
6. **Reports are read-only.** No report endpoint writes.

---

## 10. Build order

Each phase ends shippable. `npm run build` is the check after every phase; the heavy scripts stay
opt-in per [CLAUDE.md](../CLAUDE.md).

| Phase | Scope | Depends on |
|---|---|---|
| **1 — Shell** | `AdminShell`, `AdminSidebar`, `AdminTopBar`, `Breadcrumbs`, `PageHeader`, new `ADMIN_NAV`, routing skeleton, Cellvix palette (§2b), all existing pages re-homed with redirects. Responsive at four widths. | — |
| **2 — Kit** | `DataTable`, `FilterStrip`, `KpiRow`, `DateRangeBar`, `ProcessStrip`, `CreateMenu`, `CommandPalette`, chart primitives. Retrofit Orders / Clients / Inventory. | 1 |
| **3 — Dashboard** | Things-to-do cards, six KPIs, revenue chart, top clients. Extend `GET /admin/stats`. | 2 |
| **4 — Sales depth** | Invoices list and record-payment; client profile tabs; order bulk actions. | 2 |
| **5 — Purchase** | `Supplier`, `PurchaseOrder`, `Expense`, `ExpenseCategory`, `StockMovement` models, services, routes, screens, automation cycle, inventory extensions. | 2 |
| **6 — Reports** | Business Overview (with print) and the eight analytics tabs. Needs phase 5's cost and expense data to be meaningful. | 3, 5 |
| **7 — Quotes & RMA** | `Quote` and `Rma` models, builder UI, conversion, refund path through `storeCreditService`. | 4, 5 |
| **8 — Outlet, staff & roles** | `Outlet` and `Role` models, outlet list/add/edit with live preview, Users and Roles & Access screens, `requirePermission` middleware, outlet switcher. | 1, 4 |
| **9 — Marketing** | `MessageLog`, `Campaign`, `MessageTemplate`, four channel screens (**SMS/WhatsApp/Call UI-only — §6b U3–U5**), email fully wired, CASL consent and unsubscribe. Offers/Blog/FAQ already re-homed in phase 1. | 4 |
| **10 — Referrals** | `referralCode` / `referredBy`, `referralPercent`, `CREDIT_TYPES += referral`, `storeCreditService.creditReferral()`, accrual on payment, reversal on refund, admin screen. Fully functional — no UI-only part. | 4, 5 |
| **11 — Settings** | The seven categories and ~20 pages (§6.15), minus Users/Roles (phase 8) and Expense Categories (phase 5). Encrypted provider secrets, audit-log screens, and the **Calendar / Appointments UI shells — §6b U1–U2**. **Split into passes — see below.** | 5, 8, 9 |
| **12 — Cross-cutting** | Global search, notifications dropdown, My Profile, exports. **12a done (Session 35):** search + profile + the order/invoice detail screens; `ADMIN_STUB_PATHS` emptied. **12b done (Session 35):** CSV/XLSX exports honouring the active filters across five lists, and the + Create menu reading the permission map. **12c done (Session 36):** the notification bell — four stored event sources, four derived standing conditions, per-admin read state and role filtering. **Phase 12 complete.** | 3–10 |
| **13 — Wire the shells** | Clear the §6b register: connect Twilio / WhatsApp / telephony / email provider, Google OAuth, and the calendar's scheduling logic. Each entry is independently shippable. | 9, 11, + client answers |
| **A — Parity register** | Close [SAAS_PLATFORM.md](../SAAS_PLATFORM.md) §2: the three outstanding rulings, then build whatever they call for. Runs in parallel with 13 — neither blocks the other. | client rulings |
| **B — Tenancy-ready** | The four no-op items in SAAS_PLATFORM §5: feature registry, one database accessor, `requireFeature`, nav/palette/Create reading the gate. Nothing user-visible changes. | — |
| **14–18 — Platform** | Control plane · tenant resolution · super-admin console · provisioning · plans & billing. **After Cellvix ships.** Specified in SAAS_PLATFORM §6. | B, Cellvix delivery |

Phases 1–3 are what make the panel *feel* like CellShoppe. If time gets short, protect those.

**Three sequencing notes.**

Phase 8 (staff and roles) is deliberately not last. Every screen built after it inherits
`requirePermission` for free; every screen built before it needs retrofitting. Moving it earlier is
reasonable if a second operator arrives sooner than expected.

Phase 11 (Settings) is late but its **data model is not** — tax rates, shipping bands, RMA SLA,
invoice due days, warranty lengths and email toggles are all read by earlier phases. Those phases
read them from `Settings` with seeded defaults from day one; phase 11 only builds the **screens**
that edit them. Hard-coding a rate in phase 5 and "moving it to Settings later" is how you end up
with two sources of truth for the tax rate.

**Phase 11 is split into passes**, settled 2026-08-28 when it was picked up: sixteen screens, a new
`AuditLog` wired into every existing mutation, encrypted provider secrets and two UI shells is not
one shippable unit, and each pass below ends shippable on its own.

| Pass | Scope | Status |
|---|---|---|
| **11a** | `settingsService`, the six settings routes, the Summary/category map, Business Info, Sale Settings, Shipping Rates, Payment Methods, Inventory defaults. Shipping money moved out of `DELIVERY_METHODS` into `Settings`. | ✅ done (Session 35) |
| **11b** | `AuditLog`, `auditService` as the one write path, audit hooks across every money-moving, permission and settings mutation, and the Activity and Security log screens. Closes the gap phases 8, 9 and 10 each recorded. | ✅ done (Session 35) |
| **11c** | `ProviderCredential`, AES-256-GCM at rest, the write-only API Keys screen, Third-Party Apps (§6b U7), and stored keys wired into the channel predicates. | ✅ done (Session 35) |
| **11d** | `Taxonomy.aliases` wired into search, the taxonomy editor, `InvoiceStatusRule` + `InvoiceStatusRun`, and the invoice-messages screen. | ✅ done (Session 35) |
| **11e** | `Settings.communications`, Email Settings, Message Templates, and the Calendar + Appointments shells over a real `Appointment` model. | ✅ done (Session 35) — **phase 11 complete** |

**Two decisions 11b settled that §6.15 and §7.5 left open.**

*Role changes live in the **security** log, not the activity feed.* A role edit changes access for
everyone holding it at once rather than for one named account, which makes it the more powerful of
the two; splitting it from the staff changes would mean reconstructing one escalation from two
screens.

*The security log does not claim to record CSRF failures.* §6.15 lists them, but this codebase has
no CSRF middleware, so the route description names only what the log can actually contain — an
operator reading an empty result would otherwise take it as "no attacks" rather than "not measured".
The claim goes back when the check does.

`built: true` in `ADMIN_ROUTES` marks a screen that actually exists, because `phase` alone cannot:
these sixteen routes share `phase: 11` while some are real and some are still stubs. The settings
summary reads the flag.

Phase 13 exists so the UI-only work has **a named home rather than a good intention**. It is not one
task: each §6b entry is independently shippable the moment its blocker clears, and clearing one does
not wait on the others. When the register is empty, the phase is done.

---

## 11. Invariants this rework must not break

From [PROJECT_INSTRUCTIONS.md](../PROJECT_INSTRUCTIONS.md). Re-listed because an ERP panel is where
each is most likely to get broken by accident.

1. **The Shop page stays the homepage.** The ERP lives at `/admin` and nowhere else.
2. **The gradient is an accent** — active states, CTAs, progress. Never a page or card background (§2b).
3. **Price gating is server-side.** Nothing here may expose pricing to a non-approved user.
4. **Storefront stock is binary.** In stock / out of stock, never a count, never a date — however
   many exact quantities the ERP shows internally.
5. **`storeCreditService.js` is the only place a store-credit balance moves.** RMA refunds and admin
   allocations both route through it.
6. **`pricingService.js` is the only place a discount is decided.** Quotes and POs get no discount
   logic of their own.
7. **Line of credit and store credit stay apart** — separate fields, separate UI, separate ledgers.
8. **Money is integer cents; totals recompute server-side.** The client never sends a price.
9. **No `dangerouslySetInnerHTML`.** Admin-authored copy renders through `lib/richText.jsx`.
10. **`StepIndicator` is never forked.** `ProcessStrip` is a separate component (§4).
11. **Responsive is a requirement.** Four widths verified before any screen is called done.
12. **Canadian conventions** — CAD, provinces, `A1A 1A1`, GST/HST per province.
13. **Permissions are enforced server-side.** Hidden nav items are a courtesy, never the control (§7.6).
14. **Provider secrets are write-only.** Stored encrypted, returned only as `configured` plus a
    masked preview, never sent back to any client. Admin-only to set, audit-logged without the
    value (§6.15).
15. **One canonical URL per screen.** No page reachable at three different paths (§4).
16. **Every screen has a breadcrumb**, built from route metadata, never parsed from the URL (§4b).
17. **No UI-only screen fakes success.** It says what is inactive, saves what it can, and appears in
    the §6b register. Nothing reports "Sent" that was not sent.

---

## 12. Open questions

**Nothing is blocking.** Every section is screenshotted and every question asked so far is answered.
The plan can be built end to end; what is listed below are values to swap in later, all of them
editable in Settings rather than baked into code.

> **Resolved 2026-08-28, after phase 11e — and phase 11 is now complete.** Q1 briefly looked
> blocking: the Calendar and Appointments shells were the last unbuilt screens and they read from an
> `Appointment` model that did not exist. The answer was to **build the interface now and wire the
> scheduling later**, which is exactly what §6b exists to accommodate.
>
> So the model was written to the reading below — pickups, deliveries and RMA drop-offs — but kept
> deliberately loose where the guess could be wrong: `relatedTo` is a `{ kind, id }` pair rather than
> four typed refs, and `kind` is a short enum that costs nothing to extend. **There is no write route
> at all**, so nothing has been persisted against a shape that may still move. Confirming the reading
> is now phase 13's first task rather than a prerequisite.

### Deferred, not blocking — tracked in §6b

| # | Item | Placeholder in the meantime | Needed by |
|---|---|---|---|
| 1 | Warranty length per grade | Dummy days (§6b table) | Before publishing warranty terms to buyers |
| 2 | GST/HST rates, and whether a reseller certificate exempts | Standard 2026 provincial rates | Before the first real tax filing |
| 3 | Business contact details, GST number, logo | Dummy data | Before the first real invoice goes out |
| 4 | SMS / WhatsApp / telephony providers | UI-only, messages saved as `queued_unconfigured` | Phase 13 |
| 5 | Google OAuth credentials | Third-Party Apps shows setup guidance | Phase 13 |
| 6 | What the calendar actually schedules | UI shell, no writes | Phase 13 |

### One assumption still worth confirming

**The calendar's purpose.** The UI is approved and being built, but *what it schedules* is still my
reading rather than your decision: pickups, deliveries and RMA drop-offs. The shell is agnostic, so
this costs nothing now — but it decides the `Appointment` model's shape when phase 13 wires it.

**Answered and closed:** Settings structure · `Supplier Prices` columns · RMA SLA (7 days,
configurable) · external ERP integration (Cellvix is the ERP; both integration docs deleted) ·
Outlet meaning (physical stores with their own staff) · roles (named roles with per-area access,
§7.6) · storefront quotes (admin-created only for now) · expense categories (admin-managed) ·
multi-warehouse (one location, modelled for more) · **Scheduling (UI only, §6b)** · **referral
commission (approved, §6.13)** · **warranty, tax rates and business details (dummy values now,
editable in Settings)** · **message providers (UI only, §6b)** · **outlet count (one, same
location)**.

---

## 13. Changelog

| Date | Change |
|---|---|
| 2026-08-27 | Created. Home / Sales / Purchase specified from ten screenshots. |
| 2026-08-27 | Reports, Marketing and Outlet specified from fifteen more screenshots. Seven open questions answered and closed. `docs/ERP_INTEGRATION.md` and `docs/erp-integration-map.html` deleted — Cellvix is the ERP. Added §2b (Cellvix palette, binding), §7.6 (roles and permissions), §9 (money and metrics rules). Build order extended to eleven phases. Settings remains the only unseen section. |
| 2026-08-27 | **Settings specified from the final twenty-one screenshots — every section is now covered.** Added §4b (breadcrumbs, in full), §6.15 (seven Settings categories, ~20 pages, My Profile, notifications dropdown, confirmed `+ Create` grouping), and the real `Supplier Prices` spec. **§7.6 rewritten**: named `Role` records with per-area access, replacing the per-user permission map — CellShoppe's model, and the better one. Five new models (`Role`, `PaymentMethod`, `InvoiceStatusRule`, `MessageTemplate`, `Appointment`); `Settings` restructured to mirror the seven categories. Settings pages given canonical URLs instead of CellShoppe's three-ways-in mix. Four invariants added (secrets write-only, one URL per screen, breadcrumb on every screen). Discount Codes folded into Offers and Services dropped, both on Instructions grounds. |
| 2026-08-27 | **All seven remaining questions answered; nothing is blocking.** Added **§6b — the UI-only register**, the tracked list of screens shipping as interface without wiring (Calendar, Appointments, SMS, WhatsApp, Calls, Bulk Email, Third-Party Apps), each with what ships, what is deferred and what unblocks it, plus six rules they obey — chief among them that none may fake success. Added the dummy-data table (warranty, tax rates, business info, outlet) with replace-when conditions. **Referral commission approved and specified** (§6.13): accrues on payment, pays through `storeCreditService.creditReferral()`, reverses on refund, guarded against self-referral and multi-level chains; `CREDIT_TYPES` gains `referral`. Build order extended to thirteen phases, with phase 13 existing purely to clear the §6b register. Invariant 17 added. |
| 2026-08-27 | **Phase 1 built.** New shell (`AdminShell` / `AdminSidebar` / `AdminTopBar`), two-level `ADMIN_NAV`, route metadata in `client/src/lib/adminRoutes.js`, `Breadcrumbs` and `PageHeader`. `/admin` moved out of `RootLayout`; `AdminLayout.jsx` deleted. All eight existing screens re-homed with redirects from their old URLs; every unbuilt route renders `AdminStubPage` naming its phase. Verified at 375 / 834 / 1280 / 1600 with no horizontal scroll. Two breadcrumb bugs found and fixed in the process: a duplicated `Settings > Settings` crumb, and Summary highlighting for every settings page. |
| 2026-08-27 | **Phase 2 built.** The shared kit — `DataTable` (declared columns, priority-based folding into a per-row disclosure, opt-out sorting), `KpiRow` (semantic left borders, wraps rather than clips), `DateRangeBar` (URL-synced, local-time presets), `FilterStrip`, `ProcessStrip` (separate from `StepIndicator` by design) — plus a working `CommandPalette` (Ctrl+K, screens-only until `/admin/search` lands in phase 12) and `CreateMenu` (`C`, grouped Income/Expense). Charts are hand-rolled inline SVG with a visually-hidden data table each. Orders, Clients and Inventory retrofitted; Clients and Inventory moved their filters into the URL so the dashboard's `?status=pending` and `?stock=low` links work. Approvals keeps its own screen — its reject flow requires a reason the account drawer does not collect, so the §6.2 fold waits for phase 4. Verified at 375 / 834 / 1280 / 1600. |
| 2026-08-27 | **Phase 3 built.** `GET /admin/stats` takes `?from=&to=` (inclusive days, end-of-day resolved server-side) and answers with **`invoiced` and `collected` as separate named metrics** (§9.1), refunds as their own line (§9.2), receivables and inventory value as positions rather than flows, a gap-filled order-value trend (daily to ten weeks, weekly beyond), top clients and low-stock items. The old response shape survives as a subset. `AdminOverviewPage` rebuilt: URL-linkable date range, things-to-do cards that render only when non-zero, seven KPI tiles, trend chart, top clients, recent orders and low stock. Sidebar badges were reading keys the endpoint never sent and are now live. Two bugs fixed on the way: refunds were dated by `Order.updatedAt`, so any later status edit would have moved an old refund into the current period — they now come from the `CreditTransaction` ledger, which timestamps each one; and weekly bucket labels read `Dec 29 → Dec 28` for a calendar year, so they now carry the year when the range spans one. Verified at 375 / 834 / 1280 / 1600. |
| 2026-08-28 | **Phase 4 built.** Invoices list with derived-not-stored `overdue`, collection-wide pill counts, and payment recording where **`amountPaid` and status are recomputed from the payment rows** — overpayment refused rather than allowed to exceed the invoice. Voiding forgives the balance and keeps the row with its reason. `GET /admin/invoices/:number/document` added because the buyer route scopes its lookup to the signed-in user; it renders the same artefact through the same renderer. Client profile at `/admin/clients/:id` with seven URL-addressable tabs, five KPIs keeping the line of credit and store credit apart, and an activity feed merging orders, invoices, payments and credit movements until `AuditLog` lands in phase 11. The Clients drawer was removed — with a real profile route it was a second address for one record (invariant 15). Breadcrumbs gained a record-label context so a detail page can name its record in the trail (§4b.6). Order bulk actions are **partial by design**: every single-order rule still applies, and the response names what moved and what did not with a reason per skip. Verified with 19/19 write-path assertions against `cellvix_test`, plus 375 / 834 / 1280 / 1600. |
| 2026-08-28 | **Phase 9 built.** `MessageLog`, `Campaign` and `MessageTemplate`; `marketingService` with the four channels behind one `CHANNEL_PROVIDERS` table, so which providers are connected is decided in one place and every screen reads it. SMS and WhatsApp ship UI-only per U3–U4: composing writes a real row with `queued_unconfigured` and the named reason, and the screen reports that instead of a confirmation. Calls (U5) log rather than send, so they carry **no** provider notice — a warning on a screen working as designed is how warnings stop being read. Email is fully wired and stays off the register; with no `SMTP_URL` it reports the outbox by name and does not count those as sent. The send dialog reports four numbers (sent · outbox · failed · skipped), never one. **CASL enforced server-side**: consent resolved at send rather than compose so a late unsubscribe still excludes; audience stored as a filter, never a recipient list; sender identification and an HMAC'd unsubscribe link appended inside the send loop rather than left to the author; the public `/unsubscribe` page sits outside `RootLayout` and states that order and invoice mail still arrives; re-subscribing writes a new consent rather than erasing the old refusal. A one-to-one email to an unsubscribed account is refused, while an operational SMS to the same account still logs. Open/click tracking is absent rather than shown as zero. Verified: build clean and all five screens code-split; 18 marketing routes all permissioned plus the one deliberately public POST; 17 schema, 10 consent/token, 8 audience, 9 send-path and 8 unsubscribe-token cases, plus the CASL decoration asserted against real outbox output. Not verified: no database — `.env` points at the live cluster, so the data paths ran against stubbed models. |
| 2026-08-28 | **Phase 9 verified against the live cluster and in a browser**, the client having confirmed the Atlas data is still dummy. The full CASL loop ran for real: 5 matched → 4 eligible → 1 skipped, four decorated emails, a link followed from the page unsubscribing that account, an idempotent second click, a tampered token refused, and the next campaign's audience dropping 4 → 3 on its own. Permissions confirmed by role (Warehouse 403 everywhere, Account Manager 200 on marketing and still 403 on admin-only `/admin/roles`). All four screens checked at 375 / 768 / 1024 / 1440 with no horizontal overflow and no console errors. **Four fixes came out of it:** a no-consent account was being told it had "unsubscribed" (now `RECIPIENT_NO_CONSENT`, distinct from `RECIPIENT_UNSUBSCRIBED`); **a phase-8 gap — `ensureBuiltInRoles` / `ensureDefaultOutlet` ran only inside the seed, so any database not re-seeded had zero roles and no default outlet; both are additive upserts and now run at boot**; `Campaign.stats.queued` added so a sent campaign no longer reads a bare "0" with no explanation; and the send dialog's "Send to 0" is now disabled and explained rather than being a button that can only fail. The seed was updated so a fresh run reproduces the verified state. |
| 2026-08-28 | **Phase 10 built and verified live.** `User.referralCode` (minted on approval, unambiguous alphabet) · `User.referredBy` (set once at registration, no route edits it) · `Settings.financial.referralPercent` · `CREDIT_TYPES` gains `referral` · `storeCreditService.creditReferral()`, so referrals are not an exception to "the only place a balance moves". Accrual fires on `recordPayment` and is keyed on invoice number **plus payment index**, so instalments earn separately and a replay cannot pay twice; the rate is snapshotted per accrual and is never retroactive. Reversal fires on void and on full refund, keyed on the accrual it undoes, and is allowed to take the balance to zero where a spend would be refused — refusing it would leave commission standing on money that came back. Guards: self-referral rejected, one level only, `void` rows earn nothing, suspended referrers earn nothing, an unrecognised code is refused rather than silently dropped. **Admin-only, not `marketing: full`** — verified that Account Manager is refused. Verified live: $800 → $40.00 at 5%; rate raised to 10% and the earlier accrual stayed at 5% while the next earned at 10%; a payment then a void netted exactly to zero; replays and re-reversals were no-ops; four widths clean, no console errors. **One bug found and fixed:** totals were computed from each pairing's net, so a fully clawed-back accrual reported zero reversals — accruals and reversals are now tracked gross as well as netted, and the screen names both. Deferred: the buyer-facing half in `/account` (§6.13 puts the admin surface first) and audit-logging of rate changes, which waits on phase 11's `AuditLog`. |
| 2026-08-29 | **Phase 12c built — the notification bell, and phase 12 with it.** §7.3 names eight sources, and they are answered two different ways on purpose: four are **events** (registration, order, quote accepted, RMA) and are stored `Notification` rows; four are **standing conditions** (invoice overdue, low stock, out of stock, PO overdue) and are **derived from the live records on every read**, never stored. A stored "invoice overdue" row is a lie the moment the invoice is paid, and keeping it honest would need a delete hook on every payment, receipt and stock movement — eight more places to forget. `list()` merges both halves newest-first and the client cannot tell them apart. **Read state is per admin** (`readBy` / `clearedBy` as arrays, not booleans): one order is one event several staff each see separately, and a boolean would let whoever opened the bell first mark it read for everyone. `Clear All` is likewise personal — it writes `clearedBy`, never deletes, and leaves the row unread in every other bell. **Role-filtered server-side** (§7.3): every row carries the permission area that gates it, and the areas are resolved from the caller's role per request, the same rule `searchService` follows — a search result and a notification both leak the existence, the name and usually the money of a record before anybody clicks. Opening the bell marks read but does not clear: "I have seen this" and "I am done with this" are different acts. `emit()` swallows its own failures exactly as `auditService.record()` does, and refuses a derived type outright so the collection cannot accumulate rows that go stale. Polled at 60s per §7.3 ("upgraded to SSE only if that proves necessary"), and not in a background tab. The badge shows a count rather than a dot, because "3 things want you" and "something wants you" are different messages. Verified: build clean; 15 logic assertions against stubbed models covering all four derived conditions and their copy, a `minStock: 0` product correctly not reading as low, warehouse seeing stock and PO but **not** overdue invoices, sales seeing the inverse, a roleless staff account seeing nothing, per-admin read state, an idempotent ``, derived ids skipped without issuing a write, and a derived type refused by `emit`. **Not verified: no database** — no local mongod and `.env` points at the live cluster, so the data paths ran against stubs. Needs a live pass. |
| 2026-09-03 | **Superseded in three places by [SAAS_PLATFORM.md](../SAAS_PLATFORM.md)** — see the banner at the top. Cellvix is now tenant #1 of a multi-tenant ERP SaaS, and the client's requirement is a **100% CellShoppe section match with inapplicable features switched off rather than dropped**. `Web Quote` (§0.7) is reopened as a pending ruling rather than a settled drop; the Ticket → RMA and Tech → Staff Performance renames (§3) are reopened the same way and become industry-preset vocabulary in the platform. §2's tree is confirmed accurate for CellShoppe but stale for Cellvix — `ADMIN_NAV` is the source of truth, having gained Tickets, Supplier Returns, Subscription Plans and Service Products since. Build order extended with the parity register, the tenancy-ready pass, and platform phases 14–18. New sections are feature-flag-gated from now on: server-side `404`, off is invisible and never destructive. |
