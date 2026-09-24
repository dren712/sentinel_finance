# Sentinel Finance — Design System Specification (`DESIGN.md`)

> **Locked Authority**: This document is the project-level source of truth for Sentinel Finance UI/UX. All automated audits, visual refinements, and component implementations must adhere to these tokens, constraints, and rules.

---

## 1. Design Personality & Ethos

**Institutional clarity × Solana-native precision × restrained cinematic motion**

- **Not**: Cyberpunk, neon DeFi gradients, "AI magic" sparkle icons, Bloomberg terminal cosplay, or generic Tailwind SaaS templates.
- **Is**: Premium institutional fintech + modern high-throughput protocol UI + forensic on-chain risk console.

### The Core Design Principle
> *"Intelligence is fluid. Enforcement is rigid."*

| Domain | Visual Treatment | Characteristics |
| :--- | :--- | :--- |
| **AGENT (`robo-01`)** | Soft / dynamic / adaptive | Subtle indigo/slate borders, pulsed thinking pills, responsive intent drafting. |
| **SENTINEL** | Stable / structured / geometric | Rigid tabular constraints, definitive pass/fail badge gates, strict limit indicators. |
| **TRANSACTION** | Precise / deterministic | Monospace signatures, slot counters, explicit Solana Devnet state machines. |
| **PROVN RECEIPT** | Cryptographic / forensic | High-density hashes, SHA-256 state commitments, verifiable explorer proof links. |

---

## 2. Locked Color Tokens

All colors must be referenced through Tailwind utility classes or CSS custom properties. **Zero arbitrary hex values mid-component**.

```css
:root {
  /* Surfaces & Backgrounds */
  --sentinel-bg: #090B10;              /* Main canvas */
  --sentinel-surface: #111622;         /* Primary container/card background */
  --sentinel-surface-elevated: #161D2C;/* Hover state, modal surface, elevated card */
  --sentinel-surface-muted: #0D111A;   /* Recessed sub-panels, code blocks, input bg */

  /* Borders */
  --sentinel-border: #1E2638;          /* Standard structural border (1px) */
  --sentinel-border-strong: #2D3952;   /* Hover, active, or focused border */

  /* Text & Content */
  --sentinel-text: #F1F5F9;            /* Primary content (Slate-100) */
  --sentinel-text-muted: #94A3B8;      /* Secondary content, descriptions (Slate-400) */
  --sentinel-text-subtle: #64748B;     /* Metadata, uppercase micro-labels (Slate-500) */

  /* Brand & Accents */
  --sentinel-accent: #2563EB;          /* Primary interactive blue */
  --sentinel-accent-hover: #1D4ED8;
  --sentinel-accent-subtle: rgba(37, 99, 235, 0.12);

  /* Financial Semantics */
  --sentinel-success: #10B981;         /* Approved trade, compliant invariant, settled */
  --sentinel-success-subtle: rgba(16, 185, 129, 0.12);
  --sentinel-danger: #F43F5E;          /* Blocked trade, violated invariant, reverted */
  --sentinel-danger-subtle: rgba(244, 63, 94, 0.12);
  --sentinel-warning: #F59E0B;         /* High concentration, approaching limit, adapted */
  --sentinel-warning-subtle: rgba(245, 158, 11, 0.12);

  /* Protocol Networks */
  --sentinel-devnet: #A855F7;          /* Solana Devnet indicator badge */
  --sentinel-devnet-subtle: rgba(168, 85, 247, 0.12);
}
```

---

## 3. Typography & Numerical Formatting

Financial products live or die by numbers. In Sentinel, numbers must always be instantly legible and perfectly aligned.

1. **Font Families**:
   - **UI / Body**: High-legibility system sans (`-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `system-ui`).
   - **Technical / Monospace**: Clean monospace (`ui-monospace`, `SFMono-Regular`, `Menlo`, `Consolas`) for addresses, signatures, hashes, and code blocks.
2. **Tabular Numerals**:
   - **Mandatory** on all financial amounts, prices, exposures, BPS limits, percentages, and timestamps:
     ```css
     .tabular-nums, .mono-num {
       font-variant-numeric: tabular-nums;
       font-feature-settings: "tnum";
     }
     ```
3. **No Decorative Italic Headlines**:
   - Banned as an AI-slop anti-pattern. Titles use tight tracking (`tracking-tight`), crisp weight (semibold/bold), and clean sentence casing.
4. **Micro-Labels**:
   - Format: `text-[10px]` or `text-xs`, `font-semibold`, `uppercase`, `tracking-wider`, `text-sentinel-textSubtle`.

---

## 4. Hallmark 8-State Interactive Coverage

Every interactive element (buttons, tabs, inputs, cards) must explicitly define all eight states:

| State | Visual Treatment | CSS / Tailwind Pattern |
| :--- | :--- | :--- |
| **1. Default** | Clean surface with subtle 1px border | `bg-sentinel-surface border-sentinel-border text-sentinel-text` |
| **2. Hover** | Subtle surface lift, crisp border brightening | `hover:bg-sentinel-surfaceElevated hover:border-sentinel-borderStrong` |
| **3. Focus-Visible**| High-contrast accessible outline (2px) | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sentinel-accent` |
| **4. Active** | Slight compression / depressed scale | `active:scale-[0.98] transition-transform` |
| **5. Disabled** | Reduced opacity, `cursor-not-allowed` | `disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none` |
| **6. Loading** | Spinner or pulse skeleton, preserved width | `opacity-75 cursor-wait animate-pulse` |
| **7. Error** | Rose border, danger background tint | `border-sentinel-danger bg-sentinel-dangerSubtle text-sentinel-danger` |
| **8. Success** | Emerald border, verified badge check | `border-sentinel-success bg-sentinel-successSubtle text-sentinel-success` |

---

## 5. Responsive Verification Breakpoints

The UI must render immaculately without horizontal scrollbar overflow across all standard viewport widths:

- **320px** (iPhone SE small screen)
- **375px** (Standard mobile viewport)
- **414px** (Large mobile viewport)
- **768px** (Tablet viewport)
- **1024px+** (Desktop workspace)

### Mobile Transformation Rules
- Desktop multi-column comparison tables (e.g. Flagship Proposed vs. Post-State) must transform into vertically stacked verification cards on mobile (`< 768px`).
- Hashes and signatures must truncate gracefully with middle ellipsis (`0x7c54...7ca5`) on screens `< 640px` with an instant copy-to-clipboard action.
- Navigation bar collapses into accessible bottom bar or compact tab strip on mobile.

---

## 6. Motion & Animation Principles

- **State-Driven, Not Decorative**: Motion only triggers to communicate actual financial state changes:
  1. *Proposal*: Agent proposes trade -> slide-down entrance.
  2. *Evaluation*: Sentinel checks constraints -> rows calculate concurrently.
  3. *Rejection*: Violations flash red badge -> `✕ BLOCKED` lock badge surfaces.
  4. *Adaptation*: Counter animates from `$15,000` -> `$5,000` -> rows turn green -> `✓ APPROVED`.
  5. *Execution*: `PREPARING` -> `WALLET` -> `SUBMITTED` -> `CONFIRMING` -> `VERIFIED`.
- **Performance**: 60fps GPU-accelerated transitions using `transform` and `opacity` only. Zero layout thrashing (`height`/`top`/`margin` animation prohibited).
- **Core Screens Stay Fast**: Zero scroll-jacking, zero mandatory delay animations on Portfolio, Protection, Activity, or Transaction review.

---

## 7. Anti-Fabrication Content Policy

In strict adherence to Hallmark and production finance integrity:
- **No fabricated metrics**: Never render fake NAV charts, fake historical annualized yields, fake TVL, fake user testimonials, or fake trade counters.
- **Explicit Provenance**: Every number rendered on screen must be traceable to one of:
  1. **Solana Devnet On-Chain Account**: Real token balances, Policy PDA invariants, Vault PDA, confirmed transaction signatures.
  2. **Pyth Network Live Oracle**: Hermes real price, confidence interval, publish time.
  3. **PreStocks Protocol Metadata**: Live stock token metadata, issuer backing.
  4. **PostgreSQL Read History**: Real indexed agent runs, decisions, executions, snapshots.
- If data is loading or simulated, it must be explicitly labeled `SIMULATION` or `PENDING RPC`.
