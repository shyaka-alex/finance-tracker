# Student Finance Tracker

> **Live demo:** _add your GitHub Pages URL here_
> **Author:** _Your Name_ · [GitHub](https://github.com/your-username) · your.email@example.com

An accessible, responsive, vanilla HTML/CSS/JS app for tracking student spending: add transactions, search them with regular expressions, see spending stats, and stay under a monthly cap.

---

## M1 — Specification & Wireframes

### 1. Theme and purpose

**Theme:** Student Finance Tracker.

**Problem:** Students spend in many small amounts (lunch, bus fares, coffee) and lose track of where their money goes. This app records every transaction, groups it by category, shows the last 7 days of spending, and warns the user before they go over a budget cap they set.

**Constraints:** No frameworks or libraries. Works offline from `localStorage`. Fully usable with a keyboard only.

---

### 2. Data model

#### Transaction record

| Field | Type | Example | Rules |
|---|---|---|---|
| `id` | string | `"txn_0001"` | Unique, generated on create, never edited |
| `description` | string | `"Lunch at cafeteria"` | No leading/trailing spaces; no double spaces |
| `amount` | number | `12.50` | ≥ 0, max 2 decimal places, stored in base currency |
| `category` | string | `"Food"` | Letters, spaces, hyphens; must exist in category list |
| `date` | string | `"2025-09-29"` | `YYYY-MM-DD` |
| `createdAt` | string | `"2025-09-29T12:04:11.000Z"` | ISO 8601, set once |
| `updatedAt` | string | `"2025-09-30T08:15:42.000Z"` | ISO 8601, refreshed on every edit |

#### Settings object (stored separately from records)

| Field | Type | Example | Notes |
|---|---|---|---|
| `baseCurrency` | string | `"USD"` | All amounts are stored in this currency |
| `currencies` | array | `[{ code: "RWF", rate: 1300 }, { code: "EUR", rate: 0.92 }]` | Manual rates (1 base = rate), no API |
| `displayCurrency` | string | `"USD"` | Which currency the table and stats show |
| `cap` | number | `300` | Spending cap, in base currency |
| `categories` | array | `["Food", "Books", "Transport", "Entertainment", "Fees", "Other"]` | Editable in Settings |
| `theme` | string | `"light"` | Optional stretch: `"light"` or `"dark"` |

#### Storage keys

| Key | Contents |
|---|---|
| `finance:records` | Array of transaction records |
| `finance:settings` | Settings object |

**Auto-save:** every add, edit, delete, import, and settings change writes to `localStorage` immediately.

**Import validation:** an imported file is accepted only if it is a JSON array where every item has all required fields of the correct type and passes the same regex rules as the form. If any record fails, nothing is loaded and an error explaining which record failed is announced.

---

### 3. Sections

| Section | Landmark / element | Contents |
|---|---|---|
| Header | `<header>` | App name, skip link, `<nav>` to each section |
| Dashboard | `<section aria-labelledby>` | Total records, total spent, top category, 7-day trend chart, cap status (live region) |
| Transactions | `<section>` | Regex search box, case-insensitive toggle, sort controls, table (desktop) / cards (mobile), inline edit and delete |
| Add / Edit | `<section>` with `<form>` | Description, amount, category, date; inline error messages |
| Settings | `<section>` | Base currency, 2 other currencies + rates, cap, category list, import/export JSON |
| About | `<section>` | Purpose, contact (GitHub, email) |
| Footer | `<footer>` | Credits, link to repo |

---

### 4. Wireframes

> _Hand-drawn or Figma sketches are in `assets/wireframes/`. The diagrams below summarise the layout at each breakpoint._

#### Mobile (~360px) — single column

```
┌────────────────────────────┐
│ [Skip to content]          │  ← visible on focus only
│ Finance Tracker      [Menu]│  header + nav
├────────────────────────────┤
│ ┌────────────────────────┐ │
│ │ DASHBOARD  (deep green)│ │
│ │ Total spent   $245.30  │ │
│ │ Cap left      $54.70   │ │  ← live region
│ │ Top: Food · 12 records │ │
│ │ ▂ ▅ ▃ ▇ ▄ ▆ ▂  7 days  │ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ Search  [ regex...   ] │ │
│ │ [Aa] case   Sort [▼]   │ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ Lunch at cafeteria     │ │  transaction card
│ │ Food · 2025-09-25      │ │
│ │ $12.50    [Edit] [Del] │ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ ADD TRANSACTION        │ │
│ │ Description [        ] │ │
│ │ Amount      [        ] │ │
│ │ Category    [      ▼ ] │ │
│ │ Date        [        ] │ │
│ │ [   Save transaction ] │ │
│ └────────────────────────┘ │
│ Settings · About           │
│ footer                     │
└────────────────────────────┘
```

#### Tablet (~768px) — two columns

```
┌──────────────────────────────────────────────┐
│ Finance Tracker    Dashboard Records Add ... │
├──────────────────────┬───────────────────────┤
│ DASHBOARD (green)    │ ADD TRANSACTION       │
│ totals · cap · chart │ form                  │
├──────────────────────┴───────────────────────┤
│ Search [ regex... ] [Aa]   Sort [▼]          │
│ ┌──────────┐ ┌──────────┐                    │
│ │ card     │ │ card     │  2-column cards    │
│ └──────────┘ └──────────┘                    │
├──────────────────────────────────────────────┤
│ SETTINGS              │ ABOUT                │
└──────────────────────────────────────────────┘
```

#### Desktop (~1024px+) — asymmetric grid

```
┌────────────────────────────────────────────────────────────┐
│ Finance Tracker          Dashboard  Records  Add  Settings │
├───────────────────┬──────────────────────┬─────────────────┤
│ INTRO / ABOUT     │                      │ CAP STATUS      │
│ (off-white card,  │  STATS HERO          │ (turns orange   │
│  large title)     │  (deep green,        │  when over cap) │
├───────────────────┤   spans 2 rows,      ├─────────────────┤
│ ADD TRANSACTION   │   7-day bar chart)   │ TOP CATEGORY    │
│ form              │                      │                 │
├───────────────────┴──────────────────────┴─────────────────┤
│ Search [ regex... ] [Aa]                                   │
│ ┌──────────┬──────────────────────┬──────────┬───────────┐ │
│ │ Date ↕   │ Description ↕        │ Category │ Amount ↕  │ │
│ ├──────────┼──────────────────────┼──────────┼───────────┤ │
│ │ ...      │ ...                  │ ...      │ ... [✎][🗑]│ │
│ └──────────┴──────────────────────┴──────────┴───────────┘ │
├────────────────────────────────────────────────────────────┤
│ SETTINGS (currencies · cap · categories · import/export)   │
└────────────────────────────────────────────────────────────┘
```

---

### 5. Design system

Visual direction: soft, layered cards over a pale sage background, with a deep green "hero" card for stats and an orange accent reserved for warnings. Inspired by a glass-style UI mockup.

#### Colour palette

| Token | Hex | Role | Contrast (WCAG) |
|---|---|---|---|
| `--bg` | `#DDE5E0` | Page background (sage) | — |
| `--surface` | `#F6F6F3` | Cards, form, table | — |
| `--primary` | `#0F4D3A` | Nav, headings, primary buttons, stats card | ≈ 9.8 : 1 with white ✅ |
| `--secondary` | `#1E8F5E` | Chart bars, focus ring, icons | ≈ 4.1 : 1 with white — large text only ⚠️ |
| `--accent` | `#F08A4B` | Over-cap state, warnings | Dark text on it ≈ 7 : 1 ✅ · white text ≈ 2.5 : 1 ❌ |
| `--accent-text` | `#B4531A` | Orange text on light surfaces | ≈ 5 : 1 on white ✅ |
| `--text` | `#2B2B2B` | Body text | ✅ AAA |
| `--text-muted` | `#555555` | Secondary text, hints | ≈ 7.5 : 1 on white ✅ |
| `--highlight` | `#F5D9C4` | `<mark>` search highlight (with dark text) | ✅ |

**Rules:** buttons with text use `--primary`, not `--secondary`. Orange is used for status, never as the only signal: the over-cap state also changes the wording and is announced by the live region.

#### Typography

- **Font:** Manrope (Google Fonts) with a system sans-serif fallback stack.
- **Headings:** large, light weight (300–400), tight letter-spacing.
- **Labels and captions:** small, medium weight, slightly wider letter-spacing.
- **Numbers:** tabular figures so amounts line up in the table.

#### Shape, depth, and motion

- **Radius:** large (24–32px) on cards; one corner smaller on feature cards for the asymmetric look.
- **Shadows:** wide, soft, low opacity. Optional translucent cards with backdrop blur; text areas stay opaque enough to keep contrast.
- **Motion:** cards lift slightly with a deeper shadow on hover and keyboard focus; new cards fade and rise in; the cap card transitions its colour when the state changes. All motion is reduced or removed under `prefers-reduced-motion`.
- **Not included from the mockup:** brand logos and decorative 3D objects.

---

### 6. Validation rules (planned)

| Field | Pattern | Purpose |
|---|---|---|
| Description | `/^\S(?:.*\S)?$/` | No leading or trailing spaces |
| Amount | `/^(0\|[1-9]\d*)(\.\d{1,2})?$/` | Non-negative, max 2 decimals, no leading zeros |
| Date | `/^\d{4}-(0[1-9]\|1[0-2])-(0[1-9]\|[12]\d\|3[01])$/` | `YYYY-MM-DD` |
| Category | `/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/` | Letters, single spaces or hyphens |
| **Advanced** — duplicate word | `/\b(\w+)\s+\1\b/i` | Back-reference; warns on "coffee coffee" |

Each field shows its error message inline, next to the input, as the user types or leaves the field. Errors are linked to their input with `aria-describedby` and announced via a `role="status"` region.

---

### 7. Accessibility plan

| Area | Plan |
|---|---|
| Structure | `header`, `nav`, `main`, `section`, `footer`; one `h1`, `h2` per section, no skipped levels |
| Skip link | First focusable element; jumps to `<main>` |
| Labels | Every input has a `<label for>`; the search box has a visible label and a hint explaining regex |
| Focus | Clear `:focus-visible` outline in `--secondary` with an offset; never removed |
| Keyboard | Logical tab order; Enter submits; Escape cancels inline edit; delete asks for confirmation that can be answered by keyboard |
| Live regions | `role="status"` for form results and import/export messages; cap message uses `aria-live="polite"` under the cap and `"assertive"` when over |
| Search highlight | Matches wrapped in `<mark>` inside the existing text, so screen readers still read the full sentence; result count announced politely |
| Colour | All text pairs meet WCAG AA (table above); state is never shown by colour alone |
| Motion | Respects `prefers-reduced-motion` |
| Testing | Keyboard-only pass of every feature; contrast checker; browser accessibility inspector; screen reader spot check |

---

### 8. File structure

```
/
├── index.html
├── tests.html
├── seed.json
├── README.md
├── .gitignore
├── styles/
│   └── main.css
├── scripts/
│   ├── main.js        # entry point, wires modules together
│   ├── storage.js     # localStorage load/save, import/export
│   ├── state.js       # records + settings in memory, CRUD
│   ├── ui.js          # rendering, events, live regions
│   ├── validators.js  # regex rules
│   └── search.js      # safe regex compile, highlight, sort
└── assets/
    └── wireframes/
```

---

### 9. Milestone plan

| Milestone | Target | Status |
|---|---|---|
| M1 – Spec & wireframes | Mon | ☑ |
| M2 – Semantic HTML & base CSS | Mon | ☑ |
| M3 – Forms & regex validation + tests | Tue AM | ☑ |
| M4 – Render, sort, regex search | Tue PM | ☑ |
| M5 – Stats & cap | Tue PM | ☑ |
| M6 – Persistence, import/export, settings | Wed AM | ☑ |
| M7 – Polish, a11y audit, README, demo | Wed PM | ☐ (demo video pending) |

---

_Documentation drafted with AI assistance, as permitted by the assignment. All application code is my own._
