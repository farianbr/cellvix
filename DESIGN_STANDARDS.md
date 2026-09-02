# Cellvix — Design Standards

> **Binding.** Read before writing any UI. This file governs *how things look and move*.
> [PROJECT_INSTRUCTIONS.md](PROJECT_INSTRUCTIONS.md) still governs architecture, data and copy;
> where the two overlap, §2 of the Instructions points here.
>
> Phase 1 covers the **storefront and the customer account panel**. The admin panel keeps its
> current look until Phase 2 — do not half-migrate it.

---

## 0. Why this document exists

The palette, the contrast maths and the token file were never the problem. The problem is what
happened *downstream* of them. An audit of 178 components found:

| Symptom | Measured | What it reads as |
|---|---|---|
| Brand gradient on every active state | 59 uses across 42 files | The single loudest "generated" tell |
| No pressed state on any control | `active:scale` — **0** occurrences | Interface does not respond to touch |
| Type sizes chosen by nudging | 14 arbitrary sizes incl. `12.5px`, `13.5px`, `14.5px` | No scale, no hierarchy |
| Radii chosen by nudging | 18 distinct values incl. `[9px]`, `[11px]`, `[7px]` | Tokens defined, then bypassed 500+ times |
| Hover states ungated | `hover:hover` — **0** occurrences | Every hover misfires on touch |
| Panels stacked at equal weight | `space-y-4` down the page | Nothing on screen claims to matter |

**The rule that follows from this:** a design system is not a token file. It is a token file plus
the discipline that no component is allowed to invent a value outside it. Every section below
exists to remove one class of invented value.

---

## 1. Colour — the gradient demotion

### 1.1 What was wrong

`#CF3429 → #000000` at 135° is a strong mark and a weak interface material. Red-to-black is the
default "tech brand" gradient; on a nav item, a pagination button and a progress bar all at once it
stops reading as brand and starts reading as decoration applied without a reason. Worse, it is
**directional** — a 135° ramp inside a 32px pill shows one muddy brown midpoint and neither end.

### 1.2 The replacement: one accent, three registers

The gradient is not deleted. It is **demoted to a signature** and given exactly two legal homes.
Everything it used to do is taken over by flat brand ink, which is louder precisely because it is
used less.

| Register | Token | Where |
|---|---|---|
| **Signature** — the gradient | `.bg-brand-gradient` | The primary CTA, and **at most one** hero/promo block per page. Nowhere else. |
| **Accent** — flat brand | `bg-brand`, `text-brand-700` | Active nav, current page, selected chip, focus, progress fill, step indicator |
| **Quiet accent** — brand tint | `bg-brand-50`, `border-brand-100` | Selected row backgrounds, hovered filter options, soft badges |

**Deleted usages** — every one of these becomes flat:

- Sidebar / bottom-nav active item → `bg-brand-50 text-brand-700` + a 2px `bg-brand` left rail
- Pagination current page → `bg-ink-900 text-white` (page numbers are navigation, not promotion)
- Accordion chevrons and rules → `text-ink-300`
- Progress and credit meters → `bg-brand` flat, or the semantic tone when one applies
- Step indicator active dot → `bg-brand` flat
- `.text-brand-gradient` → **removed entirely.** Gradient text on a wordmark is fine; on a heading
  it is the most-copied AI-landing-page tic there is.

### 1.3 New tokens

Add to `@theme`. These exist because a red-only palette has no cool anchor, which is why every
surface currently reads warm-grey and slightly cheap.

```css
/* Warm neutral ground — replaces the flat #F7F7F9 page background.
   A page background should be a colour, not an absence of one. */
--color-canvas:      #FAF9F8;   /* page ground: warm, sits under white cards */
--color-canvas-sunk: #F5F3F1;   /* inset wells, table zebra, disabled fills */

/* Ink, warmed. The current inks are pure neutral against a warm red mark,
   which is what makes the greys read as "default Tailwind slate". */
--color-ink-950:     #14100F;   /* display headings only */

/* The one cool note in the system. Used for informational surfaces and
   selection states so that not every emphasis in the product is red. */
--color-accent:      #1B4D5C;   /* deep teal — 8.9:1 on white */
--color-accent-50:   #EFF6F8;
```

**Rule:** `--color-accent` is for *informational* emphasis (a "how this works" callout, an active
data range, a selected table row). Brand red stays for *commercial* emphasis (buy, apply, save).
Never use them for the same job on one screen.

**Contrast, computed not eyeballed.** Every pairing below was checked before these tokens were
written down. `canvas-sunk` started at `#F2F0EE` and was lightened to `#F5F3F1` **because** muted
`ink-300` meta text on a table header failed at 4.43:1:

| Pairing | Ratio | |
|---|---|---|
| `ink-700` on `canvas` | 15.62 | pass |
| `ink-500` on `canvas` | 9.01 | pass |
| `ink-300` on `canvas` | 4.79 | pass |
| `ink-300` on `canvas-sunk` | 4.55 | pass — the constraint that set this token |
| `ink-950` on `canvas` | 17.98 | pass |
| `accent` on `white` / `canvas` / `accent-50` | 9.28 / 8.83 / 8.49 | pass |
| white on `accent` | 9.28 | pass |
| `brand-700` on `canvas` | 8.38 | pass |
| white on `brand` | 5.03 | pass |

Any new token repeats this check against `surface`, its own `-50` tint, **and** reversed, before it
ships. `npm run a11y` is the backstop, not the design method.

### 1.4 Colour rules that do not change

- Never hardcode a hex in a component.
- `--color-danger` stays distinct from brand red.
- Every text-carrying colour clears 4.5:1 on `--color-surface`, on its own `-50` tint, **and**
  reversed. `npm run a11y` enforces it. New tokens above were checked against all three.

---

## 2. Type — a real scale

### 2.1 The problem

`text-[12.5px]` and `text-[13.5px]` are not design decisions, they are hesitation. 14 sizes for a
product with maybe 6 distinct roles means every component picked its own.

### 2.2 The scale

Eight steps. **No component may use a size outside this list**, and none may use an arbitrary
`text-[Npx]` value. Defined as tokens, consumed as named utilities.

| Token | Size / line-height | Role |
|---|---|---|
| `text-display` | 40px / 1.05, `-0.03em` | Page hero figure. One per page, at most |
| `text-title` | 28px / 1.15, `-0.025em` | Page title |
| `text-heading` | 20px / 1.25, `-0.02em` | Panel and section heading |
| `text-subheading` | 16px / 1.35, `-0.01em` | Card title, modal title |
| `text-body` | 14px / 1.55 | Default. Paragraphs, form values, table cells |
| `text-caption` | 13px / 1.45 | Secondary text, hints, table meta |
| `text-micro` | 12px / 1.4 | Timestamps, footnotes, dense table columns |
| `.eyebrow` | 11px / 1, `0.08em`, uppercase | Labels, badges, stat-tile captions |

Mobile keeps `16px` on **inputs only** (iOS zoom), handled inside the primitive — never by a page.

### 2.3 Families and their jobs

Unchanged, but enforced: **Archivo** display / **Inter** UI / **JetBrains Mono** identifiers.

- Numbers in columns take `.tnum`. Non-negotiable in tables, invoices, stat tiles.
- SKUs, order numbers, invoice IDs, tracking numbers are **always** mono. A buyer reads these
  character by character; a proportional font makes that measurably slower.

---

## 3. Shape, depth, spacing

### 3.1 Radius — four values, no arbitraries

| Token | Value | Applies to |
|---|---|---|
| `rounded-sm` | 6px | Chips, small badges, inline tags |
| `rounded-md` | 10px | Inputs, buttons, select triggers, table wrappers |
| `rounded-lg` | 14px | Cards, panels, stat tiles |
| `rounded-xl` | 20px | Modals, drawers, flyouts, hero blocks |
| `rounded-full` | — | Avatars, meters, pills, icon-only buttons |

`rounded-[9px]`, `rounded-[11px]`, `rounded-[12px]` and friends are **defects**. Nesting rule: an
inner radius equals the outer radius minus its padding. A 14px card with 4px padding takes a 10px
inner element — that is why the scale steps by 4.

### 3.2 Elevation — borders structure, shadows lift

Two systems, never mixed on one element.

- **Flat/bordered** — everything anchored in the page: cards, panels, tiles, table wrappers.
  `border border-line`, no shadow.
- **Lifted** — only things floating over the page: dropdowns (`--shadow-pop`), modals and drawers
  (`--shadow-flyout`), the sticky header once scrolled.

A bordered card with a drop shadow is the single most common "AI card" signature. Pick one.

### 3.3 Spacing and the layout grid

Tailwind 4px base. The rhythm that was missing:

| Context | Value |
|---|---|
| Inside a control (button, input, chip) | `gap-2` |
| Between fields in a form | `gap-4` |
| Between cards in a grid | `gap-4` md:`gap-5` |
| Between stacked panels | `gap-6` |
| Between page sections | `py-10 md:py-14` |
| Page gutter | `px-4 md:px-6 lg:px-8` |
| Max content width | `max-w-[1280px]`, `max-w-[860px]` for prose |

---

## 4. Page layout — the intention rule

**The diagnosis:** account and admin pages are a vertical stack of equal-weight bordered boxes.
Every panel looks equally important, so none is. This is what "no intention" means concretely.

### 4.1 Every page declares a hierarchy

Three tiers. A page picks a **primary** and demotes everything else — no exceptions.

```
┌─ PAGE HEADER ───────────────────────────────────────────────┐
│  eyebrow / breadcrumb                                        │
│  text-title            [ primary action ]                    │
│  one line of context in text-caption                         │
└──────────────────────────────────────────────────────────────┘
┌─ PRIMARY ───────────────────────────────┐┌─ SUPPORTING ─────┐
│  The reason the page exists.            ││  Context. Never   │
│  Widest column, most contrast,          ││  competes. Sits   │
│  only place a figure gets text-display. ││  in a narrower    │
│                                         ││  column, quieter. │
└─────────────────────────────────────────┘└───────────────────┘
┌─ TERTIARY (full width, quiet) ──────────────────────────────┐
│  Activity, history, related. Borderless or canvas-sunk.     │
└──────────────────────────────────────────────────────────────┘
```

**Rules:**

1. A page has **one** primary region. If two things compete, one is not primary — split the page.
2. Supporting content is **narrower and quieter**, never a same-width box below the primary.
3. Tertiary content drops its border and sits on `--color-canvas-sunk`. Recession is a real tool;
   currently the product only knows how to add emphasis, never remove it.
4. `space-y-4` down a page of identical panels is a defect, not a layout.

### 4.2 Account panel specifically

- The sidebar is navigation chrome: `text-caption`, `text-ink-500`, active row is
  `bg-brand-50 text-brand-700` with a 2px `bg-brand` left rail. **No gradient.**
- Overview leads with **one** number the buyer actually came for (available credit), at
  `text-display`. Everything else is `text-heading` or smaller.
- Stat tiles are supporting, never primary. Four tiles of equal weight at the top of a page is the
  layout that made the panel feel generated — put the primary figure first, tiles under it.

### 4.3 Responsive

Unchanged from Instructions §3.1 and still binding: 320–767 / 768–1023 / 1024–1439 / 1440+
designed deliberately. Additions:

- Tables **never** scroll horizontally on mobile. They become stacked cards below `md`.
- Modals become bottom sheets below `md` (full width, `rounded-t-xl`, no side margin).
- The primary/supporting split collapses to primary-first single column; supporting content never
  outranks the primary by appearing above it.

---

## 5. Motion

Framer Motion stays. The values change. Current motion is uniform 220ms `[0.22, 1, 0.36, 1]` on
everything — one curve for every job is why it reads robotic.

### 5.1 The gate — should it animate at all?

| Frequency seen | Decision |
|---|---|
| 100+/day (keyboard shortcuts, cart open) | **No animation.** |
| Tens/day (hover, list nav, filter apply) | Near-imperceptible or nothing |
| Occasional (modal, drawer, toast) | Standard animation |
| Rare (order placed, approval granted) | The delight budget lives here |

**Never animate a keyboard-initiated action.** Filtering already follows this — the grid crossfades
and does not stagger. Keep that.

### 5.2 Easing tokens — replace the current pair

```css
--ease-out:     cubic-bezier(0.23, 1, 0.32, 1);      /* entrances, exits — default */
--ease-in-out:  cubic-bezier(0.77, 0, 0.175, 1);     /* on-screen movement, morphs */
--ease-drawer:  cubic-bezier(0.32, 0.72, 0, 1);      /* drawers, sheets — iOS curve */
```

**`ease-in` is banned on UI.** It delays the first frame, which is the frame the user is watching.

### 5.3 Durations

| Element | Duration |
|---|---|
| Button press | 100–160ms |
| Tooltip, small popover | 125–200ms |
| Dropdown, select, filter panel | 150–250ms |
| Modal, drawer | 200–300ms |
| Toast | 250ms in, 200ms out |

Nothing over 300ms except the Thank You sequence. **Exit is faster than enter** — the user has
already decided.

### 5.4 The rules that fix "robotic"

1. **Every pressable element gets `active:scale-[0.97]`** at 120ms. Currently zero do. This one
   change does more for perceived quality than everything else in this section.
2. **Never `scale(0)`.** Enter from `scale(0.96)` + `opacity: 0`.
3. **Popovers and dropdowns scale from their trigger**, not from centre — set `transform-origin` to
   the anchor. **Modals are exempt** and stay centred.
4. **Gate every hover** behind `@media (hover: hover) and (pointer: fine)`. Zero components do this
   today, so every hover state fires as a sticky tap state on mobile.
5. **Transitions, not keyframes**, for anything triggerable twice in a second (toasts, filter
   chips, toggles). Keyframes restart from zero; transitions retarget.
6. **Animate `transform` and `opacity` only.** `clip-path` is the sanctioned fourth. `height` is
   tolerated only for accordions.
7. **In Motion, use the full transform string** — `animate={{ transform: 'translateY(0)' }}`, not
   `animate={{ y: 0 }}`. The shorthands are not hardware-accelerated and drop frames under load.
8. **Springs only for gestures** — drag-to-dismiss on the mobile drawer. `{ type: 'spring',
   duration: 0.5, bounce: 0.2 }`. No bounce on chrome.
9. **`prefers-reduced-motion`** means gentler, not zero: keep opacity and colour, drop transforms.

### 5.5 Loading

- **Skeletons, never spinners**, for anything that occupies layout. Skeletons match the real
  content's shape — a text skeleton is text-height, not a generic block.
- Skeleton shimmer sweeps, not `animate-pulse`: a linear gradient translating across at 1.4s
  linear. Pulse reads as a placeholder; sweep reads as loading.
- Spinners are for **in-button** states only, where there is no layout to hold.
- A fast spinner makes an app feel faster at identical load time. 600ms/rotation, not 1s.
- Filter refetch keeps its current behaviour: crossfade the grid, do not stagger cards.

---

## 6. Components

Each entry is the target. Existing primitives are edited toward it — **no new parallel component**.

### 6.1 Buttons

- Variants stay: `primary` (the gradient's home), `solid`, `outline`, `subtle`, `ghost`,
  `brandSoft`, `danger`.
- Add `active:scale-[0.97]` to all. Replace `hover:brightness-110` on `primary` — brightness on a
  gradient shifts its hue. Use a darker gradient stop instead.
- Sizes `xs/sm/md/lg` map to the radius scale, not to `rounded-[8px]` arbitraries.
- Loading state keeps its width — never let a button resize when the spinner swaps in.
- Icon-only buttons are square and `rounded-md`, and **must** carry `aria-label`.

### 6.2 Modals, sheets, confirmations

- Desktop: centred, `rounded-xl`, `--shadow-flyout`, scrim `bg-ink-950/40` + `backdrop-blur-[2px]`.
- Enter `opacity 0 → 1`, `scale(0.96) → 1`, 220ms `--ease-out`. Exit 160ms. Origin **centre**.
- Below `md`: bottom sheet, full width, `rounded-t-xl`, enter `translateY(100%) → 0` with
  `--ease-drawer`, drag-to-dismiss with velocity > 0.11 dismissing regardless of distance.
- Scrim click closes unless the modal holds unsaved input.
- **Confirmation modals** state the consequence, not the question. Title names the object
  ("Delete invoice INV-2043"), body states what happens and what cannot be undone, the destructive
  action is `danger` and is **not** the default focus. Cancel is `outline` and focused first.

### 6.3 Dropdowns, selects, filters

- One `SelectMenu`. It is already portalled and anchored — keep that, it is correct.
- Enter `scale(0.96)` + `opacity 0` → 1 at 180ms `--ease-out`, **origin at the trigger**.
- Option rows: 36px, `text-body`, hover `bg-canvas-sunk`, selected `bg-brand-50 text-brand-700` with
  a check. Counts sit in their own muted column so labels truncate independently.
- Filter panels animate `height` only when collapsing a group; option lists never stagger.
- Active filter chips: `rounded-full`, dismissible, and they **animate out** — a chip that vanishes
  instantly makes the grid look like it broke.

### 6.4 Search

- Trigger is `rounded-md`, `h-11`, icon at `text-ink-300`.
- Results panel opens at 150ms; **no animation on keystroke-driven result changes** — that is a
  100+/day interaction and animating it makes typing feel laggy.
- Show a skeleton row set on first query only; subsequent queries keep the old results visible and
  dim to `opacity-60` rather than blanking.
- Empty state names the query and offers the nearest category, never a bare "No results".

### 6.5 Forms

- Label `text-caption` `text-ink-700`, field `h-11`, `rounded-md`, hint/error `text-micro`.
- Error state: `border-danger` + `text-danger` message with icon. **Never colour alone** — the icon
  and the message carry it for colour-blind users.
- Errors appear on blur, not per keystroke; they clear on the first corrected keystroke.
- Required is an asterisk **and** the native attribute, as today.
- Multi-step forms use the shared `StepIndicator`. Never fork it.
- Submit button shows in-place loading and the form disables — never a full-page overlay.

### 6.6 Tables

The biggest layout offender after the gradient.

- Wrapper `rounded-lg border border-line overflow-hidden`, header `bg-canvas-sunk`,
  `.eyebrow` column labels, `text-ink-500`.
- Rows 48px, `border-t border-line`, hover `bg-canvas` (gated behind `hover:hover`).
- Numeric columns right-aligned with `.tnum`. Identifiers in mono.
- **Below `md` the table becomes stacked cards.** No horizontal scroll, ever.
- Sortable headers show direction with a chevron; the sorted column stays `text-ink-900`.
- Empty, loading and error states are all designed — loading is skeleton **rows** matching column
  widths, not a spinner over an empty box.
- **Pagination**: current page is `bg-ink-900 text-white` (not the gradient), siblings are
  `text-ink-700`. Always show total count and range — "41–60 of 384". Page-size control on any
  table that can exceed 100 rows.

### 6.7 Stat tiles

- Currently four identical boxes — the archetypal generated dashboard. Fix the hierarchy:
- A tile carries: `.eyebrow` label, the figure at `text-heading` `.tnum`, and **one** piece of
  context (delta or hint) at `text-micro`.
- Deltas are signed and coloured semantically (`ok` / `danger`), with an arrow glyph so colour is
  not the only channel.
- Tiles are `border border-line`, **no shadow**, `rounded-lg`.
- On a page with a genuine primary figure, tiles are supporting — smaller, and below it.
- Optional sparkline sits at the tile's foot, `h-8`, single stroke, no axes, no fill gradient.

### 6.8 Alerts and toasts

- Four tones only: `info`, `ok`, `warn`, `danger` — mapped to the semantic tokens.
- Inline alert: `rounded-md`, `bg-<tone>-50`, `border-l-2 border-<tone>`, icon + text. Left rule,
  not a full border — a fully outlined tinted box is heavy and reads as a banner ad.
- Toasts bottom-right on desktop, top on mobile. Enter from the edge they exit through.
- 250ms in / 200ms out, `--ease-out`, transitions not keyframes.
- Auto-dismiss at 5s; error toasts **never** auto-dismiss. Pause the timer when the tab is hidden.
- Swipe-to-dismiss on touch, velocity-based.

### 6.9 Icons

Current: `lucide-react`, 151 imports. **Keep Lucide** — it is consistent, tree-shakeable and
already everywhere; swapping icon libraries across 151 call sites buys nothing a discipline fix
does not. What changes is *how* it is used, which is where the inconsistency actually is:

| Rule | Value |
|---|---|
| Sizes | `size-4` inline, `size-5` standalone, `size-6` feature. Nothing else. |
| Stroke | `1.75` default, `2` on small/dense, `1.5` on large decorative. Never mixed in one row. |
| Colour | Inherits. `text-ink-300` decorative, `text-ink-500` functional, tone colour for status. |
| Meaning | One concept, one glyph, product-wide. Never two icons for "order". |
| a11y | `aria-hidden` beside a label; `aria-label` on the control when icon-only. |

If a genuinely premium set is wanted later, **Phosphor** (`@phosphor-icons/react`) is the upgrade —
six weights, and its `duotone` weight gives status icons a second colour channel Lucide cannot. That
is a Phase 2 decision; do not mix the two libraries in Phase 1.

---

## 7. Invoices and email

These render outside the app and cannot use Tailwind or the token file. They get their own
constrained expression of the same system.

### 7.1 Invoice (PDF / print)

- A4 with 18mm margins. Black `#14100F` on white. **No gradient, no tinted panels** — an invoice is
  a legal document and colour ink costs the buyer money to print.
- Masthead: logo left at 32px height, "INVOICE" + number right in mono.
- Bill-to and ship-to as two columns; issue date, due date, terms and PO in a labelled block.
- Line table: description, SKU (mono), qty, unit, line total. Hairline `#E5E5EA` rules, no zebra.
- Totals right-aligned, right third of the page. Subtotal, discount, **GST/HST with the registration
  number**, shipping, then total at 1.6× weight with a 2px rule above.
- Brand red appears **once**: a 3px rule under the masthead. That is the whole colour budget.
- Footer carries remittance details, terms, and the Cellvix legal entity.
- All money `.tnum`, right-aligned, two decimals, CAD.

### 7.2 Email templates

- **Table-based, inline styles, 600px max width.** No flexbox, no grid, no external CSS, no
  web fonts — Outlook supports none of it.
- Font stack `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`.
- Header: logo on white, 24px padding. **Never a gradient header** — Outlook renders the fallback
  colour only, so half the recipients see a flat black bar.
- One primary action as a bulletproof VML-padded button in flat `#CF3429`, min 44px tall.
- Body 16px/1.5 `#1F1F23`. Headings 22px Archivo-fallback bold.
- Order and invoice tables collapse to stacked rows under 480px via a media query, with
  `width:100%` fallback where media queries are unsupported.
- Every email ships a plain-text alternative and a working unsubscribe link.
- Dark mode: set `color-scheme` and avoid pure-white PNGs — the logo needs a transparent variant.

---

## 8. Definition of done — design

A UI change is not done until all of these hold. This is additive to Instructions §9.

- [ ] No arbitrary `text-[Npx]` — every size is on the §2.2 scale
- [ ] No arbitrary `rounded-[Npx]` — every radius is on the §3.1 scale
- [ ] No hardcoded hex; every colour is a token
- [ ] Gradient appears only on a primary CTA or one hero block
- [ ] Every pressable element has `active:scale-[0.97]`
- [ ] Every hover state is gated behind `@media (hover: hover)`
- [ ] Bordered *or* shadowed, never both
- [ ] The page declares one primary region; supporting content is visibly quieter
- [ ] Loading is a shape-matched skeleton, not a spinner over empty space
- [ ] Empty, loading and error states all designed
- [ ] Verified at 320 / 768 / 1024 / 1440; no horizontal page scroll at any width
- [ ] Tables become cards below `md`; modals become sheets below `md`
- [ ] Focus visible on every interactive element; icon-only controls carry `aria-label`
- [ ] Colour is never the only channel for meaning
- [ ] `prefers-reduced-motion` drops transforms, keeps opacity
- [ ] `npm run build` clean

---

## 9. Phase plan

**Phase 1 — storefront + customer account panel (this phase)**

1. Token layer: new colours, type scale, easing curves, radius enforcement
2. Primitives: Button, Input, Select, Modal, Drawer, Badge, Skeleton, Pagination, Table, StatTile,
   Alert/Toast
3. Gradient demotion across all 42 files
4. Layout intention pass: Shop, Product, Cart, Checkout, Account (11 pages)
5. Motion pass against §5
6. Invoice + email templates

**Phase 2 — admin panel.** Not started until Phase 1 ships. The admin shell keeps its current look
until then; a half-migrated admin is worse than an un-migrated one.
