# Sentinel Finance — UI & Skill Governance Guidelines (`docs/UI_GUIDELINES.md`)

## 1. Skill Governance Hierarchy

When designing, refactoring, or auditing the Sentinel frontend, the three specialized design skills operate under a strict command hierarchy:

```text
                 SENTINEL PRODUCT UX
                          │
                          ▼
            ┌───────────────────────────┐
            │       DESIGN.md           │
            │   Locked Project System   │
            └─────────────┬─────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
   ┌─────────────────┐         ┌─────────────────┐
   │    HALLMARK     │         │   TASTE SKILL   │
   │  The Authority  │         │  Visual Polish  │
   │ Audit, 8-State, │         │  Type Rhythm,   │
   │ Anti-Fabricate  │         │  Micro-Spacing  │
   └────────┬────────┘         └────────┬────────┘
            │                           │
            └─────────────┬─────────────┘
                          ▼
               ┌─────────────────────┐
               │    SCROLL-CRAFT     │
               │   Selective Only    │
               │  Hero Demo / Story  │
               └──────────┬──────────┘
                          ▼
                  FINAL QA & AUDIT
```

### The Three Laws of Skill Delegation

1. **Hallmark is the Governing Authority**:
   - Primary reviewer for UI quality, accessibility, token enforcement, 8-state coverage, and responsive verification (320px/375px/414px/768px).
   - Preserves application information architecture; never allows an AI to arbitrarily re-engineer the financial product structure.
   - Enforces the anti-fabrication mandate: zero fake NAV, zero fake TVL, zero fake user counts.

2. **Taste Skill is Restricted to Polish**:
   - Focuses strictly on typographic rhythm, letterspacing, contrast ratios, and density.
   - **Explicit Boundary**: Per its upstream specification, Taste Skill is *not* a dashboard or data-table engine. It is strictly prohibited from altering financial data grids, policy forms, or transaction state machines.

3. **Scroll-Craft is Restricted to Storytelling**:
   - Confined exclusively to the Hero Story Centerpiece (`HeroStoryCenterpiece.tsx`) and the 5-step autonomous cycle walkthrough.
   - **Explicit Boundary**: Absolutely zero scroll-jacking or mandatory delay animations inside Portfolio, Protection, Activity, or Transaction review.

---

## 2. Screen-by-Screen Product Guidelines

### A. Portfolio (`PortfolioView.tsx`)
- **Vibe**: Quiet, institutional, dense, trustworthy.
- **Numbers**: Tabular numerals (`tnum`) everywhere. Asset balances, prices, USD valuations, and portfolio allocations must align vertically down the penny.
- **Motion**: Minimal. Only subtle micro-highlights on balance updates.
- **Responsiveness**: Stacks into asset cards with explicit exposure meters below 768px.

### B. Agent (`AgentView.tsx`)
- **Vibe**: Intelligent, deliberate, active.
- **State Feedback**: Explicitly communicates what `robo-01` is thinking:
  - `IDLE` (monitoring markets)
  - `ANALYZING` (reading Pyth feeds & portfolio weights)
  - `PROPOSING` (drafting trade intent)
  - `EVALUATING` (submitting to Sentinel preflight)
  - `ADAPTING` (counter-proposal upon violation)
  - `SETTLING` (broadcasting guarded Devnet transaction)
- **Controls**: Scenario switcher (`Flagship`, `PreStocks`, `Meteora`, `Pyth`) with instant execution.

### C. Protection & Policy (`GuaranteesView.tsx`)
- **Vibe**: Calm, authoritative, fiduciary.
- **Controls**: Financial risk levers, not casual consumer sliders.
  - Max Single-Asset Concentration (`25.0%` / `2500 BPS`)
  - Minimum Stablecoin Reserve (`20.0%` / `2000 BPS`)
  - Maximum Single Trade Size (`$10,000 USD`)
  - Maximum Allowable Slippage (`1.00%` / `100 BPS`)
  - Emergency Circuit Breaker (Instant Pause toggle)
- **Authority Banner**: Clearly states that updates prepare unsigned transactions for the user's browser wallet to sign; backend never signs policy modifications.

### D. Activity & Decision History (`ActivityView.tsx`)
- **Vibe**: Forensic audit log, immutable trail, high density.
- **Elements**:
  - Filterable by type (`ALL`, `BLOCKED`, `ADAPTED`, `SETTLED`).
  - Dual verification badges: `Indexed in Postgres` + `Confirmed on Solana Devnet`.
  - Direct links to Solana Explorer for every transaction signature.
  - Clickable PROVN receipt drawer linking intent hash, policy hash, pre-state hash, and post-state hash.

### E. Decision Inspector (`FlagshipEnforcementCard.tsx`)
- **Vibe**: The flagship hero moment — the visualization of Sentinel's moat.
- **Comparison Grid**:
  ```text
  PROPOSED INTENT: BUY NVDAx $15,000
  -----------------------------------------------
  SENTINEL POST-STATE EVALUATION:
    NVDAx Concentration : 20.0% -> 35.0%  [LIMIT 25.0%]  ✕ BLOCKED
    USDC Cash Reserve   : 25.0% -> 10.0%  [MIN 20.0%]    ✕ BLOCKED
    Trade Size          : —     -> $15K   [MAX $10K]     ✕ BLOCKED
  -----------------------------------------------
  RESULT: ✕ BLOCKED (State transition prevented)
  -----------------------------------------------
  AUTONOMOUS ADAPTATION:
    Adapted Intent      : BUY NVDAx $5,000
    NVDAx Concentration : 20.0% -> 25.0%  [LIMIT 25.0%]  ✓ COMPLIANT
    USDC Cash Reserve   : 25.0% -> 20.0%  [MIN 20.0%]    ✓ COMPLIANT
    Trade Size          : $5K             [MAX $10K]     ✓ COMPLIANT
  -----------------------------------------------
  RESULT: ✓ APPROVED & SETTLED ON DEVNET
  ```

---

## 3. The 16-Step Frontend Execution Workflow

1. **Step 1**: Read existing application and synchronize with `DESIGN.md`.
2. **Step 2**: Run Hallmark audit on current frontend components.
3. **Step 3**: Produce UI punch list (visual, hierarchy, tokens, accessibility, 8-state coverage).
4. **Step 4**: Lock Sentinel design tokens in `tailwind.config.ts` and `globals.css`.
5. **Step 5**: Refine Portfolio view (`PortfolioView.tsx`).
6. **Step 6**: Refine Agent view (`AgentView.tsx`).
7. **Step 7**: Refine Protection view (`GuaranteesView.tsx`).
8. **Step 8**: Refine Activity view (`ActivityView.tsx`).
9. **Step 9**: Polish Decision Inspector (`FlagshipEnforcementCard.tsx`).
10. **Step 10**: Enhance PROVN Evidence drawer (`SentinelReceiptCard.tsx`).
11. **Step 11**: Add 8-state transaction UX to `TransactionModal.tsx`.
12. **Step 12**: Apply Taste Skill typographic and micro-spacing polish.
13. **Step 13**: Apply selective Scroll-craft motion to Hero Story Centerpiece.
14. **Step 14**: Run responsive verification across 320px, 375px, 414px, 768px viewports.
15. **Step 15**: Re-run Hallmark audit to confirm zero slop or fabricated metrics.
16. **Step 16**: Final compilation check, automated tests, and git push.
