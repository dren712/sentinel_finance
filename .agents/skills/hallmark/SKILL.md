---
name: hallmark
description: Production-grade UI review, redesign, and anti-slop audit engine. Enforces locked design tokens, structural variety, honest un-fabricated content, 8-state interactive coverage, responsive verification (320/375/414/768px), and strict preservation of application information architecture.
---

# Hallmark: Production UI Audit & Quality Engine

Hallmark is the **governing authority** for Sentinel Finance frontend audits, reviews, and quality enforcement.

## Core Rules for Financial & Protocol Products

1. **Preserve Application Information Architecture**
   - In audit/refactor mode, never restructure financial product routes, tabs, state machines, or component ownership without explicit approval.
   - Sentinel is a mission-critical financial application, NOT a landing page.

2. **Locked Design Tokens (Zero Mid-Render Improvisation)**
   - All colors, spacing, radii, and shadows must derive from locked named tokens (`--sentinel-*` / `sentinel-*`).
   - Reject ad-hoc hex values (`#123456`) scattered inside component inline styles or arbitrary Tailwind classes.

3. **Anti-Fabrication & Honest Content**
   - **Zero fake metrics**: Never invent fake NAV, fake APY, fake TVL, fake user testimonials, or synthetic volume counts.
   - If a metric does not exist on Solana Devnet or via Pyth/PreStocks/Meteora, state it honestly or omit it.

4. **8-State Interactive Coverage**
   Interactive components (buttons, inputs, toggles, tabs, cards) must explicitly define:
   1. `default`
   2. `hover`
   3. `focus-visible` (accessible high-contrast outline)
   4. `active`
   5. `disabled`
   6. `loading` / `pending`
   7. `error`
   8. `success` / `verified`

5. **Responsive Verification Hard Floors**
   Verify layouts across strict breakpoints:
   - **320px** (small mobile)
   - **375px** (standard mobile)
   - **414px** (large mobile)
   - **768px** (tablet)
   - **1024px+** (desktop)
   - **Rule**: Zero horizontal scroll overflow. Data tables and decision inspectors must transform into stacked mobile cards below 768px.

6. **Anti-Slop Audit Checks**
   - No decorative italic headlines.
   - No generic multi-colored blurred glow blobs behind everything.
   - No low-contrast muted gray-on-gray text.
   - Tabular numerals (`tnum`) mandatory for all financial amounts, prices, percentages, and timestamps.
