---
name: design-taste-frontend
description: Visual taste and anti-slop polish layer. Governs typographic rhythm, proportional spacing, visual hierarchy, restrained density, and nuanced micro-interactions.
---

# Design Taste Frontend (Visual Taste Layer)

A curated polish layer designed to make the interface feel deliberately engineered rather than machine-generated.

## Scope of Authority in Sentinel

- **ALLOWED DOMAINS**:
  - Typography scale & micro-letterspacing (`tracking-tight` on headings, uppercase micro-labels).
  - Spacing rhythm and proportional whitespace.
  - Visual hierarchy, contrast tuning, and subtle surface elevation.
  - Restrained transitions (micro-easing, state feedback).
  - Empty states, badges, and status pills.
  - Hero story centerpiece visual refinement.

- **STRICTLY DISALLOWED DOMAINS**:
  - Do NOT modify financial data tables or force landing-page macro-layouts onto dashboards.
  - Do NOT alter transaction state machines, policy invariant forms, or execution flows.
  - Hallmark and `DESIGN.md` override Taste Skill whenever financial precision or state density is concerned.

## Core Taste Rules

1. **Typographic Discipline**
   - High visual contrast between labels (`0.75rem / uppercase / textSubtle`) and values (`1.25rem+ / bold / textPrimary / tabular-nums`).
   - Monospace reserved strictly for cryptographic hashes, addresses, signatures, and raw hexadecimal receipts.

2. **Surface Depth**
   - Deep neutral dark surfaces: `#090B10` background -> `#111622` cards -> `#161D2C` interactive hover/elevated.
   - Clean, crisp 1px borders with intentional contrast (`#1E2638`), never fuzzy muddy borders.

3. **Restrained Micro-Transitions**
   - 150ms–200ms `cubic-bezier(0.16, 1, 0.3, 1)` easing.
   - No bouncy cartoon springs or superfluous physics in financial panels.
