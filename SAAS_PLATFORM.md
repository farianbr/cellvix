# Cellvix Platform — Multi-Tenant SaaS Plan

> **Binding**, at the same level as [PROJECT_INSTRUCTIONS.md](PROJECT_INSTRUCTIONS.md). Where this
> file and the Instructions disagree about tenancy, this file wins; on everything else — design
> tokens, money rules, filter architecture, tone — the Instructions win and this file adds nothing.
>
> **Read order:** [CLAUDE.md](CLAUDE.md) → [PROJECT_INSTRUCTIONS.md](PROJECT_INSTRUCTIONS.md) →
> [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md) → **this file** →
> [docs/ADMIN_ERP_REWORK.md](docs/ADMIN_ERP_REWORK.md) → [PROGRESS.md](PROGRESS.md).

---

## 0. What this document is, and what it is not

**The end state:** one codebase, deployed once, running a multi-tenant ERP that any service or
retail business subscribes to — repair shops, auto garages, salons, clinics, appliance service, IT
services, tailors, print shops, equipment rental, field service, general retail. We operate it. Each
subscriber is a **tenant** with **its own database**. We hold a **super admin** console above every
tenant, where we create tenants, set their plan, and **toggle features on and off per tenant**.

**What it is not:** a rewrite, and not the current sprint. Cellvix is the first tenant and has a
delivery date; the SaaS layer is built *after* Cellvix ships, in phases 14–18 below. The purpose of
writing it now is that a handful of decisions made during the Cellvix work — how a request finds its
database, whether a nav item can be switched off, whether a model file assumes one connection — are
**cheap now and expensive later**. §5 lists exactly those, and nothing else, as work that happens
during the Cellvix phase.

### The three-stage sequence

| Stage | Scope | Status |
|---|---|---|
| **A — Cellvix parity** | The admin panel matches CellShoppe section for section. Single tenant, one database, no flags in the product. §2 is the gap register that closes this stage. | **Current work.** |
| **B — Tenancy-ready** | Feature flags exist and gate the nav; every model and service reaches its database through one accessor rather than a global connection. Still one tenant, still one database — nothing user-visible changes. §5. | Runs alongside A where it is free to do so. |
| **C — Platform** | Control plane, super admin console, tenant provisioning, per-tenant databases, plans and billing, industry presets. §6–§9. | After A ships. |

Stage B is the whole reason this document exists before stage C. Skipping it does not save time; it
moves the cost to a migration that has to touch every model file at once.

---

## 1. Vocabulary — fixed now, because these words end up in schemas

These are the nouns the code uses. They are chosen here so that two sessions do not invent two names
for the same record.

| Term | Means | Not to be confused with |
|---|---|---|
| **Platform** | Us. The company operating the SaaS. | — |
| **Super admin** | A platform-level account. Creates tenants, sets plans, toggles features. Lives in the control plane and has **no row in any tenant database**. | A tenant's own `admin`, who is the most powerful account *inside* one tenant and can never see another tenant. |
| **Tenant** | One subscribing business. Cellvix is tenant #1. Owns exactly one database. | An **outlet**, which is a physical location *inside* one tenant (`Outlet`, already built). |
| **Control plane** | The one database holding tenants, plans, feature flags, super admins and billing. Never holds business records. | A tenant database, which holds business records and never holds another tenant's. |
| **Plan** | A named subscription tier. Carries a default feature set and limits. | A tenant's **feature set**, which is the plan's defaults *plus* per-tenant overrides. |
| **Feature** | A switchable capability — a nav section, a screen, or a behaviour. Identified by a stable string key. | A **permission**, which is what a *role inside a tenant* may do with a feature that is already on. §4.4. |
| **Industry preset** | A named starting feature set + vocabulary for a business type (repair shop, salon, clinic…). A convenience at provisioning time, nothing more. | A hard-coded product variant. There is one product. |

**Never write "trade"** — the Instructions §10 ban applies here in full. Also avoid "client" for a
tenant in code: `client/` is the frontend workspace and `Client` is already a buyer record inside a
tenant. In prose "our client" meaning Cellvix is fine; in code the noun is **`Tenant`**.

---

## 2. Stage A — the CellShoppe parity register

The client's requirement is a **100% section match** with CellShoppe. Some of
[docs/ADMIN_ERP_REWORK.md](docs/ADMIN_ERP_REWORK.md) §0 deliberately dropped or renamed sections;
that document's decisions stand until a row below is ruled on.

**How this register works.** Every CellShoppe section observed in the forty-six screenshots
(ADMIN_ERP_REWORK §2) is listed with what Cellvix has today. Rows marked **RULING NEEDED** are not
built until the ruling lands — building against a guess is how a section gets built twice.

### 2.1 Present and matched — no action

| CellShoppe | Cellvix today | Note |
|---|---|---|
| Home | `/admin` | Dashboard, KPIs, things-to-do. |
| Sales → Customers | `/admin/clients` | Labelled "Customers"; key and route stay `clients`. |
| Sales → Invoice | `/admin/invoices` | Plus detail, payments, void. |
| Sales → Quote | `/admin/quotes` | Admin-created. |
| Purchase → Supplier | `/admin/suppliers` | |
| Purchase → Purchase Order | `/admin/purchase-orders` | With the automation cycle strip. |
| Purchase → Expense | `/admin/expenses` | Plus categories. |
| Purchase → Inventory | `/admin/inventory` | Plus `StockMovement`. |
| Reports → all eight tabs | `/admin/reports` + `/admin/reports/business` | Business Overview · Summary · P&L · Sales · Expense · Inventory · Tax · Staff Performance. |
| Marketing → Call / Email / SMS / WhatsApp | `/admin/marketing/*` | Email wired; the other three UI-only per §6b. |
| Outlet → Add / List | `/admin/outlets/add`, `/admin/outlets` | |
| Settings → all seven categories | `/admin/settings?cat=` | ~20 pages. |

### 2.2 Renamed — ruling needed

| CellShoppe | Cellvix today | Why it was renamed | Ruling |
|---|---|---|---|
| **Ticket** (repair job) | **RMA / Returns** + a separate **Tickets** screen | ADMIN_ERP_REWORK §3: no repair jobs in wholesale, so the pipeline record became an RMA. A `Tickets` screen has since been added too, so both nouns exist. | ✅ **RULED 2026-09-03 — collapse to Tickets. RMA is dropped as a section**; a return request *is* a ticket. See §2.2.1. |
| **Tech Performance** | **Staff Performance** | No technicians in wholesale. | **RULING NEEDED** — label only; the data is the same either way. |

#### 2.2.1 Ticket absorbs RMA — what this actually means

**Ruled 2026-09-03:** there is one pipeline record and it is a **ticket**. A return request is a
ticket with a return reason, not a separate `Rma` document in a separate section.

This is a merge of two live models, so it is not a rename and must not be done as one:

- **`Rma` data is migrated into `Ticket`, never dropped.** RMA records are referenced by orders,
  store-credit refunds and the audit trail. Instructions §5.7 — history is append-only — applies in
  full: an existing RMA keeps its identity and its ledger links after the merge.
- **Refunds still route through `storeCreditService`.** The section merging changes where a return is
  *managed*, not how money moves. SAAS_PLATFORM §10.6 and ADMIN_ERP_REWORK §11.5 both still bind.
- **`/admin/rma` and `/admin/rma/:id` redirect** to their ticket equivalents rather than 404ing.
  Invariant 15 (one canonical URL per screen) is why the old paths cannot simply both keep working.
- **A ticket carries a type** — return, repair, support, warranty — so the wholesale return flow and
  a future repair-shop tenant's job flow are the same record with a different `type`. This is what
  makes the merge a *platform* win and not just a Cellvix tidy-up: §7.1's per-industry pipeline nouns
  now all map to one model.
- **The RMA SLA, states and reason codes survive** as ticket fields. The behaviour was specified in
  ADMIN_ERP_REWORK §6.3 and is not being redesigned by this ruling.

> **Not yet built.** This ruling settles the target; the merge is a scoped piece of work with a data
> migration in it, and is listed in the parity queue rather than done in passing.

> **Note for stage C.** Both rows are *vocabulary*, and vocabulary is exactly what an industry preset
> swaps (§7.3). A repair-shop tenant would read "Ticket" and "Tech Performance"; a wholesale tenant
> reads "RMA" and "Staff". Ruling these for Cellvix does not lock the platform — but it does decide
> what Cellvix ships, so it is still a ruling.

### 2.3 Dropped — ruling needed

| CellShoppe | Status | Why it was dropped | Ruling |
|---|---|---|---|
| **Sales → Web Quote** | **Absent.** The only genuinely missing section. | ADMIN_ERP_REWORK §0.7: storefront quote requests are out of scope; `Quote.source` was modelled for it but no entry point exists. CellShoppe's own screen shows "Website Database Not Connected". | ✅ **RULED 2026-09-03 — build it.** It is the storefront's Contact Us form, surfaced in the admin as an inbox. See §2.3.1. |

#### 2.3.1 Web Quote is the storefront contact form

**Ruled 2026-09-03:** Web Quote is not a second quoting engine. It is the **inbox for the
storefront's Contact Us submissions** — a request that arrives from the public site, which an admin
reads and can turn into a real `Quote`.

This closes a gap that was already on the backlog from the other end: PROGRESS's hardening list has
carried *"an admin inbox for contact messages"* since before this direction was set. The `ContactMessage`
model already exists and already stores submissions; they have simply had nowhere to be read.

- **Existing `ContactMessage` documents are the data source.** No new capture path on the storefront,
  no second form. What is missing is the admin surface, not the record.
- **Statuses**: new → read → converted / closed. A converted request links to the `Quote` it became,
  so the trail from a public enquiry to a priced quote is one hop.
- **Converting creates a normal `Quote`** through the existing path. Pricing stays in
  `pricingService` (Instructions §5.5.1) — a web request never carries a price of its own, and
  nothing here becomes a second place a discount is decided.
- **Guests can submit**, so this is the one Sales surface whose source record is not tied to an
  account. Where a submission's email matches a known account, the admin screen links them; where it
  does not, it stays an unattached enquiry rather than silently opening an account.
- **Feature key `sales.webquotes`** (§3.1), gated like every other section. A tenant with no public
  storefront switches it off and the routes 404.

> **Note on the CellShoppe screen this matches.** CellShoppe's own Web Quote page renders
> *"Website Database Not Connected"* — the section exists there but has never had a working feed
> behind it. Ours is wired from day one, because the submissions are already in our database. This is
> a place where matching the section is right and copying the implementation would not be.

### 2.4 Cellvix has, CellShoppe does not — keep

Not gaps. Listed so a future session does not "fix" them by deleting.

Approvals · Credit & AR · Referrals · Offers · Blog · FAQ · Supplier Returns · Subscription Plans ·
Service Products · Taxonomy editor.

> **The Sales sub-tree is already ahead of the ADMIN_ERP_REWORK spec**, which was written before
> Tickets, Supplier Returns, Subscription Plans and Service Products were added. That document's §2
> is an accurate record of *CellShoppe*; it is no longer a complete record of *Cellvix*. Read
> `ADMIN_NAV` in [`shared/schemas/admin.js`](shared/schemas/admin.js) for what actually exists.

### 2.5 Rule for closing this register

A row leaves this table only when it is **built and verified**, or when a ruling explicitly drops it
and that drop is recorded in the changelog with a date. "We decided not to bother" without a dated
row is how a client requirement goes missing.

---

## 3. Stage B — feature flags

The client's ask is: *for Cellvix, if a feature isn't applicable, we can turn it off.* That is the
same mechanism the platform needs, so it is built once and used twice.

### 3.1 What a feature is

A **feature key** is a stable, lowercase, dot-free string. It names a *capability*, never a screen's
file path, so a screen can move without breaking a tenant's configuration.

```
sales.quotes        purchase.orders       marketing.sms
sales.webquotes     purchase.expenses     marketing.whatsapp
sales.rma           purchase.inventory    marketing.calls
sales.tickets       purchase.suppliers    marketing.referrals
sales.invoices      purchase.returns      marketing.offers
sales.orders                              marketing.blog
sales.clients       reports.pl            marketing.faq
sales.approvals     reports.tax
sales.credit        reports.staff         outlet.multi
                                          scheduling.calendar
storefront.public   settings.taxonomy     scheduling.appointments
storefront.checkout integrations.api      billing.storecredit
```

The list above is illustrative of the *shape*, not final. The canonical list lives in
`shared/schemas/features.js` (stage B, §5.1) and is the only place a key is defined.

### 3.2 Rules a feature flag obeys

1. **Server-side is the enforcement; the nav is a courtesy.** Exactly as with permissions
   (ADMIN_ERP_REWORK invariant 13). A disabled feature's routes return `404` — not `403`, because a
   tenant without a feature should not learn it exists. Hiding a nav item and leaving the route open
   is a defect, not a partial implementation.
2. **Off means invisible, not broken.** A disabled feature removes its nav entry, its `+ Create`
   entry, its command-palette entries, its notification sources, its dashboard tiles and its report
   tabs. A screen that renders an empty page with a working breadcrumb has not been turned off.
3. **A flag never hides data that already exists.** Turning `sales.quotes` off stops new quotes and
   removes the screen; it does not delete `Quote` documents and it does not remove quotes from an
   invoice's history. Re-enabling restores the screen with its records intact.
4. **Money and ledger features are not flaggable.** `pricingService`, `storeCreditService`, the
   `CreditTransaction` ledger and `AuditLog` run for every tenant always. A tenant that can switch
   off its own audit trail is a tenant that cannot be audited.
5. **A flag is resolved once per request** and carried on the request object, alongside the tenant
   and the user's permissions. Nothing re-reads the flag set mid-request.
6. **Defaults are on for what Cellvix uses today.** Introducing the flag layer must be a no-op for
   the running product — if enabling flags changes one pixel of Cellvix, the default set is wrong.

### 3.3 Where a flag is decided

```
Plan defaults  →  tenant overrides  →  effective feature set
   (control plane)     (control plane)        (cached per request)
```

Only a **super admin** writes either side. A tenant admin **sees** which features are on — a
read-only list in Settings, so an operator can tell "we do not have that" from "it is broken" — and
can never change one. Self-service upgrades are a billing question, not a flag question, and are out
of scope until §9.

---

## 4. Stage C — the tenancy model

### 4.1 Database-per-tenant. Decided.

Each tenant gets **its own MongoDB database**. One control-plane database sits above them.

```
cellvix_control          tenants · plans · features · superadmins · billing · provisioning jobs
cellvix_t_cellvix        the Cellvix ERP — every model in server/src/models
cellvix_t_<slug>         the next tenant, same shape, zero shared documents
```

**Why, given the alternative was one database with a `tenantId` on every document.** A shared
database makes every single query a potential cross-tenant leak: one `Model.find({ status })` that
forgets its tenant filter silently serves another business's customers, invoices and margins. There
is no test that proves the absence of that bug across a codebase this size. Database-per-tenant makes
the isolation **structural** — a query cannot reach a database its connection is not attached to, so
the failure mode becomes "no data" rather than "someone else's data". For an ERP holding credit
limits, cost prices and customer lists, that trade is not close.

**What it costs, stated honestly:** a schema change must run across N databases, so migrations become
a first-class tool (§8) rather than an afterthought; cross-tenant analytics require a roll-up job
rather than a query; and connection count grows with tenants, which §4.3 bounds.

### 4.2 How a request finds its database

```
request
  → resolve tenant     (subdomain, custom domain, or super-admin impersonation header)
  → load tenant record (control plane, cached)
  → refuse if suspended / unprovisioned
  → get connection     (pooled, per tenant)
  → bind models        (models are factories over a connection, never global)
  → resolve features   (plan defaults + overrides)
  → resolve user + permissions (from THIS tenant's database)
  → controller
```

**Tenant resolution order**, first match wins: custom domain → subdomain → super-admin
impersonation header (only valid on a super-admin session) → refuse. There is no "default tenant"
fallback in production; a request that cannot name its tenant is refused, because the alternative is
that a misconfigured host quietly serves tenant #1's data to everyone.

In development a single-tenant escape hatch (`SINGLE_TENANT_DB`) keeps `npm run dev` working exactly
as it does today. It is refused when `NODE_ENV=production`.

### 4.3 Connections

One Mongoose connection per tenant, held in an LRU pool with an idle-eviction timeout and a hard
ceiling. Beyond the ceiling the least-recently-used connection closes. Models are **bound to a
connection**, which is the change §5.2 makes: `mongoose.model('Order', schema)` becomes
`connection.model('Order', schema)` behind one accessor, so no controller learns about tenancy.

### 4.4 Features versus permissions — kept apart

They are two gates and they are checked in this order:

```
is this feature on for this tenant?   → no: 404
may this role use it?                 → no: 403
```

A feature is **platform-level** (we sold it or we did not). A permission is **tenant-level** (their
admin gave this staff account access or did not). Collapsing them into one check means a tenant admin
could grant a permission for a feature the tenant does not have, or a super admin's flag would read
as a permissions bug to the operator. Two checks, two status codes, two error messages.

### 4.5 What the super admin can and cannot do

**Can:** create, suspend and delete tenants · set a plan · override individual features · read
platform-level aggregates (tenant count, storage, activity) · trigger provisioning and migrations ·
impersonate a tenant admin for support, **audit-logged into that tenant's own `AuditLog` with the
super admin named**.

**Cannot, without an explicit, logged, time-boxed impersonation:** read a tenant's business records.
There is no super-admin screen that lists customers, invoices or margins across tenants. Support
access being possible is unavoidable; support access being *silent* is a choice, and this document
chooses against it.

---

## 5. What changes during the Cellvix phase — and nothing more

Stage B work, in the order it should happen. Each item is a no-op for the running product.

### 5.1 Feature registry — `shared/schemas/features.js`

One CommonJS module (the server and `shared/` are CommonJS — Instructions §0) exporting the
canonical `FEATURES` list, each entry carrying `key`, `label`, `description`, `area`, `default` and
`locked` (§3.2 rule 4). `ADMIN_NAV` rows gain an optional `feature` key naming the flag that gates
them. Nothing reads it yet.

### 5.2 One database accessor

Every `require('mongoose').model(...)` call moves behind a single accessor module. Today it returns
the one global connection, so behaviour is unchanged; in stage C it returns the request's tenant
connection. **This is the item that is cheap now and expensive later** — 32 model files touched once
in a mechanical pass, versus the same 32 files touched during a migration with live tenants.

### 5.3 Feature gate middleware

`requireFeature(key)` alongside the existing `requirePermission`. Until the control plane exists it
reads the default set and always passes. Applied as routes are touched, not in one sweep.

### 5.4 Nav and shell read the gate

`AdminSidebar`, `CreateMenu`, `CommandPalette` and the notification sources filter on the effective
feature set. With everything defaulting on, the rendered panel is byte-identical to today's.

### 5.5 Explicitly NOT during the Cellvix phase

No control plane · no super-admin console · no subdomain routing · no billing · no per-tenant
connection pool · no industry presets · no migration runner. Building any of these before Cellvix
ships trades a committed delivery date for a feature nobody has asked to use yet.

---

## 6. Stage C build order

Each phase ends shippable. Phase numbering continues ADMIN_ERP_REWORK's, which ends at 13.

| Phase | Scope | Depends on |
|---|---|---|
| **14 — Control plane** | `cellvix_control` database. `Tenant`, `Plan`, `Feature`, `SuperAdmin`, `PlatformAuditLog` models. Separate connection, separate auth realm, its own session cookie. No UI yet. | Stage B |
| **15 — Tenant resolution** | Resolver middleware, connection pool, model binding switched to per-request connections, `SINGLE_TENANT_DB` dev escape hatch. Cellvix becomes tenant #1 by provisioning, not by migration. | 14 |
| **16 — Super admin console** | Its own app shell at a separate host, reusing the admin kit (`DataTable`, `KpiRow`, `PageHeader`) and the design tokens. Tenant list, tenant detail, plan assignment, the feature toggle matrix, impersonation with its audit trail. | 15 |
| **17 — Provisioning** | Create a tenant: database, indexes, seed reference data, first admin invite, industry preset applied. Suspend, resume, export, delete-with-retention. Idempotent and resumable — provisioning half a tenant must be recoverable. | 16 |
| **18 — Plans & billing** | Plan tiers, limits (users, outlets, storage), usage metering, the payment integration, dunning and what a past-due tenant can still do (read, always; write, per policy). | 17 |

**Phase 15 is the risky one** and should be protected in scheduling: it is the phase where every
model changes how it reaches its data. It is also the phase §5.2 exists to make small.

---

## 7. Industry presets

The end-state pitch is "any service or retail business". The product does not fork per industry —
**one codebase, one schema**. What varies is three things, and only three:

1. **Which features start on.** A salon does not need Purchase Orders on day one; a repair shop does
   not need wholesale approvals.
2. **Vocabulary.** The same pipeline record reads *Ticket* (repair), *Job* (garage), *Appointment*
   (salon, clinic), *RMA* (wholesale). One label map per preset, resolved at render.
3. **Seeded reference data.** Expense categories, default statuses, message templates.

### 7.1 Presets to support, and the record each maps to

| Industry | Pipeline record reads | Notable features off by default |
|---|---|---|
| Repair shop | Ticket | approvals, credit |
| Auto garage | Job | approvals |
| Salon / spa | Appointment | purchase orders, RMA |
| Clinic | Appointment | purchase orders, RMA, offers |
| Appliance service | Job | approvals |
| IT services | Ticket | inventory (optional) |
| Tailor | Order | purchase orders |
| Print shop | Job | — |
| Equipment rental | Booking | RMA |
| Field service | Job | storefront |
| General retail | Order | quotes, approvals |
| **Wholesale (Cellvix)** | RMA | scheduling |

### 7.2 Rules

- A preset is **a starting point, never a lock**. Every feature it sets remains individually
  toggleable afterwards.
- A preset **never changes a schema or a route**. If an industry appears to need a new field, the
  field is added for everyone and defaults to unused.
- Vocabulary is a **label map, not a translation layer**. Keys, routes, permissions and feature flags
  keep their canonical names in every industry — only what an operator reads changes. A support
  session that has to guess which noun a tenant is looking at is the failure this rule prevents.

### 7.3 Where §2.2's rulings land

The Ticket/RMA and Tech/Staff Performance renames become preset vocabulary entries. Ruling them for
Cellvix decides the *wholesale* preset's labels and nothing else.

---

## 8. Operating a fleet of databases

The honest cost of §4.1, and the tooling that pays it.

- **Migrations run per tenant, tracked per tenant.** A versioned migration runner with a recorded
  applied-list in each tenant database. Partial fleet state — 30 tenants migrated, 4 failed, 1 mid-run
  — is the normal case, not an error case, and the runner reports it as such.
- **A schema change ships in two steps**, always: add-and-tolerate, then remove. Code never assumes a
  migration has completed on the tenant currently serving the request.
- **Backups are per tenant**, and restore is per tenant. Restoring one tenant must never touch
  another — which is the same property §4.1 bought.
- **Cross-tenant analytics come from a roll-up job** writing aggregates into the control plane. Never
  a fan-out query across tenant databases at request time.
- **Deleting a tenant is a two-stage, reversible-then-final operation** with a retention window. An
  ERP holds a business's financial records; an immediate irreversible drop is not an acceptable
  implementation of a cancelled subscription.

---

## 9. Open questions — stage C

Not blocking stage A or B. Recorded so they are answered before phase 14, not discovered during it.

| # | Question | Why it matters |
|---|---|---|
| 1 | Tenant addressing: subdomain (`acme.app.ca`), custom domain, or both? | Decides certificate handling and the resolver's first branch (§4.2). |
| 2 | Does every tenant get a public storefront, or is that itself a feature? | Cellvix's storefront is core; a clinic's is meaningless. Likely `storefront.public`. |
| 3 | Data residency — must Canadian tenants' data stay in Canada? | Decides hosting region strategy before, not after, the first non-Canadian tenant. |
| 4 | Who owns a tenant's data on cancellation, and in what export format? | Belongs in the terms of service and in phase 17's export. |
| 5 | Plan tiers and limits — what actually differs between them? | Phase 18 cannot start without it. Feature flags make it configurable, not decided. |
| 6 | Does a tenant admin get self-service feature upgrades, or does every change go through us? | §3.3 assumes the latter. |
| 7 | Support impersonation policy — time-boxed, per-incident approval, tenant-notified? | §4.5 assumes logged-and-visible; the specifics are a policy decision. |

---

## 10. Invariants the platform work must not break

The ADMIN_ERP_REWORK §11 list stays in force in full. These are additions, all of them specific to
tenancy.

1. **A tenant's data never leaves its database.** No cross-tenant query, no shared collection holding
   business records, no cache keyed without the tenant.
2. **A request without a resolved tenant is refused** — never served from a default.
3. **The control plane holds no business records.** Tenants, plans, flags, billing and platform audit
   only.
4. **Features are enforced server-side**, returning `404` for a disabled feature. Nav filtering is a
   courtesy (§3.2 rule 1).
5. **Features and permissions stay separate checks** with separate status codes (§4.4).
6. **Ledger, pricing and audit features are never flaggable** (§3.2 rule 4).
7. **Super-admin impersonation is always logged into the target tenant's own audit trail**, naming
   the super admin (§4.5).
8. **One codebase, one schema.** Industry presets change defaults, labels and seed data — never
   routes, fields or logic (§7.2).
9. **A disabled feature never destroys data** (§3.2 rule 3).
10. **Model files never reach a global connection directly** — always through the accessor (§5.2).

---

## 11. Changelog

| Date | Change |
|---|---|
| 2026-09-03 | **Two of the three rulings answered.** **Web Quote: build it** — it is the storefront Contact Us inbox over the existing `ContactMessage` model, converting to a real `Quote` through `pricingService`, and it closes the "admin inbox for contact messages" item that was already on PROGRESS's hardening list (§2.3.1). **RMA is dropped as a section: a return request is a Ticket** (§2.2.1) — one pipeline record with a `type`, which also makes §7.1's per-industry nouns (Ticket / Job / Appointment / RMA) one model rather than four. The merge migrates `Rma` data rather than dropping it, keeps refunds on `storeCreditService`, and redirects the old URLs. Still open: Tech vs Staff Performance. |
| 2026-09-03 | Created. Three-stage sequence (Cellvix parity → tenancy-ready → platform) settled. **Database-per-tenant decided** over shared-`tenantId`, on isolation grounds (§4.1). Feature-flag layer specified with server-side `404` enforcement and the features-vs-permissions split (§3, §4.4). Super-admin scope bounded, impersonation required to be logged into the tenant's own audit trail (§4.5). Stage-B work limited to four items, with §5.5 naming what is explicitly out of scope until Cellvix ships. Build order extended with phases 14–18. §2 opened as the CellShoppe parity register — **three rulings outstanding**: Ticket/RMA, Tech/Staff Performance, and Web Quote, the one genuinely absent section. Eleven industry presets listed; twelve platform invariants recorded. |
