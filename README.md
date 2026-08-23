# Cellvix

B2B wholesale marketplace for replacement electronics parts — screens, batteries, cameras and
housings for repair shops, refurbishers and resellers across Canada.

Trade pricing is gated behind admin approval, the catalogue is filtered through three separate UIs
that share one state, and every dollar in a cart is recomputed on the server from live product
records. Prices, discounts and stock are never accepted from the browser.

**Stack:** React 19 · Vite 6 · Tailwind v4 · Express 4.21 · MongoDB / Mongoose 8 · Zod.
JavaScript ESM throughout, npm workspaces.

---

## Quick start

```bash
npm install                 # root + both workspaces
cp .env.example .env        # then fill in MONGODB_URI and JWT_SECRET
npm run seed                # wipes and populates whichever DB MONGODB_URI names
npm run dev                 # client on :5173, API on :4000
```

The Vite dev server proxies `/api` to `:4000`, so the app is same-origin in development and the
httpOnly session cookie travels without CORS credential handling.

### Demo accounts

Password for all three: `Cellvix123!`

| Email | What it demonstrates |
| --- | --- |
| `buyer@cellvix.ca` | Approved business — trade pricing, Net 30 terms, order and invoice history |
| `pending@cellvix.ca` | Awaiting approval — can browse and hold a cart, cannot see prices or order |
| `admin@cellvix.ca` | Admin — approvals queue, product/order/customer management, editorial consoles |

---

## Environment

Both workspaces read one `.env` at the repo root. `server/src/config/env.js` validates it with Zod
and **exits at boot** with a named error if anything is missing or malformed — a half-configured
server is worse than none.

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | **yes** | No in-memory fallback. Prefer a replica set — order creation runs in a transaction. Any Atlas cluster is one. |
| `JWT_SECRET` | **yes** | Minimum 16 characters. The server refuses to start in production if this is still the development placeholder. |
| `NODE_ENV` | no | `development`, `test` or `production` |
| `PORT` | no | Defaults to `4000` |
| `JWT_EXPIRES_IN` | no | Defaults to `7d`. "Remember me" issues 90d instead; without it the cookie is a session cookie. |
| `COOKIE_NAME` | no | Defaults to `cellvix_session` |
| `CLIENT_ORIGIN` | no | Comma-separated list of origins allowed to send credentialed requests |
| `MOCK_PAYMENT_DECLINE` | no | Forces the mock gateway to refuse every charge, so `/payment-failed` can be exercised |
| `VITE_API_URL` | no | Defaults to `/api` |

`.env` is gitignored. Only `.env.example` is tracked.

---

## Scripts

```bash
npm run dev            # client + server together
npm run build          # production client bundle
npm run seed           # WIPES taxonomy, products, users, orders, invoices — then reseeds
npm run seed:content   # blog, FAQ and offers only; safe on a database with real accounts
npm run smoke          # 202 end-to-end API assertions
npm run a11y           # axe-core WCAG 2.1 AA audit across 39 surfaces
npm run shoot          # Playwright screenshot set -> docs/screenshots/
```

> `smoke`, `a11y` and `shoot` all **write real data** — `shoot` places an actual order, moving
> stock, invoices and credit. Point them at a throwaway database:
>
> ```bash
> MONGODB_URI="<uri>/cellvix_test" npm run seed
> MONGODB_URI="<uri>/cellvix_test" npm run smoke
> ```

The seed is deterministic — a seeded PRNG produces the same 177 taxonomy nodes and 420 SKUs on
every run, so screenshots and assertions stay stable.

---

## Architecture

### One filter state, three UIs

The shop page is the homepage; there is no separate landing page and no category routes. A sidebar
accordion, a three-panel mega menu and a step-by-step tab wizard all read and write **one** Zustand
store (`client/src/store/filterStore.js`). Selecting a brand in the mega menu updates the sidebar
and the wizard, mirrors into the URL, and re-renders only the product grid over AJAX. Nothing
navigates.

### Server layering

```
route -> controller -> service -> model
```

Controllers never touch Mongoose. Business logic and queries live in `server/src/services/`.

Three services own an invariant outright:

- **`pricingService.js`** is the only place a discount is decided. Offers never stack, a product
  carries at most one offer, a promo code cannot reach inside a combo bundle, single-use codes are
  checked against order history rather than a counter, and account-restricted offers answer
  `OFFER_NOT_FOUND` to everyone else.
- **`storeCreditService.js`** is the only place a store-credit balance moves. Every change writes a
  `CreditTransaction`; no balance is ever set by hand.
- **`payment.js`** is the only gateway-aware file. A PO number beginning `DECLINE` routes checkout
  to `/payment-failed`, so the failure path is reachable without touching config.

Store credit — what the business already holds, from refunds, advance recharges and admin
allocations — and the line of credit (`creditLimit` / `balance` / `terms`, what Cellvix lends) are
two separate instruments, kept apart everywhere they appear. Only store credit spends itself at
checkout.

### Money

Stored as **integer cents**. Cart, checkout quote and placed order all run the same `priceCart()`
pass, recomputed server-side from live product records. The client never sends a price, a subtotal
or a discount — it sends SKUs and quantities.

---

## Security posture

- **The price gate is server-side.** For anyone who is not an approved buyer the serializer omits
  `price` from the payload entirely — not blurred, not zeroed. The client's blur is cosmetic. The
  same gate covers a combo offer's bundle price.
- **Availability leaves as a boolean.** The storefront says in stock or out of stock. On-hand counts
  and shipment dates are wholesale-operations numbers and stay in the admin payload.
- **Sessions are httpOnly JWT cookies**, `sameSite: lax`, `secure` in production. A cookie that no
  longer resolves to a user is actively cleared rather than left to expire.
- **Approval gate, not a credential error.** A pending account signs in successfully and is told it
  is still under review. Pricing and ordering are blocked separately by `requireApproved`.
- **Query values can never become Mongo operators.** Express's default `qs` parser turns
  `?brand[$ne]=x` into a nested object; `app.js` selects the `simple` parser so query values arrive
  as strings and arrays only, and every equality assignment is coerced with `String()`.
- **Every mutating route validates through a shared Zod schema** in `shared/schemas/`, used by the
  client form and the server route alike.
- **Rate limiting** on credential endpoints and the unauthenticated contact form.
- **No `dangerouslySetInnerHTML` anywhere.** Admin-authored copy — blog, FAQ, offers — renders
  through `client/src/lib/richText.jsx`.
- Helmet, `x-powered-by` disabled, stack traces suppressed in production, and payment methods stored
  as brand plus last four digits only.

---

## Conventions

- Canadian throughout — CAD, provinces, `A1A 1A1` postal codes, GST/HST.
- The brand gradient `#CF3429` to `#000000` is an **accent** — CTAs, active states, progress. Never
  a page or card background.
- One `StepIndicator` component serves the tab wizard, checkout and order tracking.
- History is append-only. Catalogue entries deactivate rather than delete, because orders reference
  products by id.
- A cart needs only sign-in; **ordering** needs approval. A pending business keeps its cart while it
  waits.

---

## Project documentation

| File | What it is |
| --- | --- |
| [PROJECT_INSTRUCTIONS.md](PROJECT_INSTRUCTIONS.md) | The rules — design tokens, filter architecture, data model, full API contract, definition of done. Binding. |
| [PROGRESS.md](PROGRESS.md) | Phase board, decisions log, session log, known gaps, open questions. |
| [CLAUDE.md](CLAUDE.md) | Session primer for AI coding agents. |
| [cellvix-project-brief.md](cellvix-project-brief.md) | The client's original brief. Read-only reference. |
| [docs/ERP_INTEGRATION.md](docs/ERP_INTEGRATION.md) | Planned ERP integration surface. |

---

## Status

All nine build phases are complete: foundation and design system, data layer, shop page, cart and
checkout, accounts, admin, static pages, editorial surfaces, and the offers engine.

`npm run smoke` passes 202/202. `npm run a11y` reports 0 violations across 39 surfaces.

Outstanding work is either hardening or blocked on the client — chiefly the forgot-password flow,
which needs a transactional mail provider to be chosen. `PROGRESS.md` tracks both lists.
"# cellvix" 
