---
name: scroll-craft
description: Cinematic scroll-driven storytelling and progressive state reveal engine. Strictly confined to the landing overview, product narrative, and autonomous agent demonstration loop.
---

# Scroll-Craft: Cinematic Storytelling Layer

Scroll-Craft delivers purposeful, progressive choreography that visualizes Sentinel's core thesis:
**"Intelligence is fluid. Enforcement is rigid."**

## Scope of Authority in Sentinel

- **ALLOWED DOMAINS**:
  - Landing / Hero demonstration centerpiece (`HeroStoryCenterpiece.tsx`).
  - Progressive 5-step autonomous cycle reveal:
    `AGENT PROPOSAL -> SENTINEL POST-STATE -> BLOCKED -> ADAPTATION -> GUARDED EXECUTION -> PROVN PROOF`.
  - Explainer diagrams and forensic verification receipt breakdown.

- **STRICTLY DISALLOWED DOMAINS**:
  - **Zero scroll-jacking or forced slow reveals on core operational screens**:
    - Portfolio Overview (`PortfolioView.tsx`)
    - Protection & Policy Settings (`GuaranteesView.tsx`)
    - Decision Activity & History (`ActivityView.tsx`)
    - Transaction Review & Wallet Confirmation modals
  - Core financial workflows must be instantaneous, highly legible, and under the user's complete control.

## Motion Principles
- State-driven: Every visual change must correspond to an actual Solana or Sentinel state transition.
- 60 FPS GPU-accelerated transforms (`translate3d`, `opacity`), zero layout thrashing (`top`/`margin` animation prohibited).
