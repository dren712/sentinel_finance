'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Play,
  RotateCcw,
  Terminal,
  Cpu,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Sliders,
  Activity,
  ExternalLink,
  Layers,
  Lock,
  Scale,
  RefreshCw,
  FileCode,
  Hash,
} from 'lucide-react';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';
import { formatAddress } from '@/lib/formatters';

interface LandingViewProps {
  onEnterApp: () => void;
  onRunDemo: () => void;
  isRunningDemo?: boolean;
}

type SimulationScenario = 'CONCENTRATION' | 'PRE_IPO' | 'COMPLIANT';

export const LandingView: React.FC<LandingViewProps> = ({
  onEnterApp,
  onRunDemo,
  isRunningDemo = false,
}) => {
  // Active Hero Simulation State
  const [activeScenario, setActiveScenario] = useState<SimulationScenario>('CONCENTRATION');
  const [heroStep, setHeroStep] = useState<number>(3); // 1: Proposed, 2: Projected, 3: Blocked, 4: Adapted, 5: Settled
  const [isHeroAdapted, setIsHeroAdapted] = useState<boolean>(false);

  // Playground Interactive State
  const [tradeAmount, setTradeAmount] = useState<number>(15000);
  const [selectedAsset, setSelectedAsset] = useState<'NVDAx' | 'OPENAIx' | 'AAPLx'>('NVDAx');
  const [isLabAdapted, setIsLabAdapted] = useState<boolean>(false);

  // Asset profiles for playground
  const assetProfiles = {
    NVDAx: {
      name: 'NVIDIA Tokenized Equity',
      symbol: 'NVDAx',
      universe: 'Listed Tokenized Equity',
      currentPrice: 120.0,
      currentShare: 20.0,
      concentrationCap: 25.0,
      safeMaxOrder: 5000,
      orderCap: 10000,
    },
    OPENAIx: {
      name: 'OpenAI Pre-IPO Secondary',
      symbol: 'OPENAIx',
      universe: 'PreStocks Protocol Secondary',
      currentPrice: 210.0,
      currentShare: 18.0,
      concentrationCap: 20.0,
      safeMaxOrder: 2000,
      orderCap: 10000,
    },
    AAPLx: {
      name: 'Apple Tokenized Equity',
      symbol: 'AAPLx',
      universe: 'Listed Tokenized Equity',
      currentPrice: 200.0,
      currentShare: 15.0,
      concentrationCap: 30.0,
      safeMaxOrder: 10000,
      orderCap: 10000,
    },
  };

  const currentAsset = assetProfiles[selectedAsset];
  const effectiveTradeAmount = isLabAdapted ? currentAsset.safeMaxOrder : tradeAmount;
  const portfolioTotal = 100000;

  // Real invariant computations
  const currentAssetValue = (currentAsset.currentShare / 100) * portfolioTotal;
  const projectedAssetValue = currentAssetValue + effectiveTradeAmount;
  const projectedShare = (projectedAssetValue / portfolioTotal) * 100;
  const currentCashShare = 25.0; // 25% cash initial
  const projectedCashShare = Math.max(0, currentCashShare - (effectiveTradeAmount / portfolioTotal) * 100);

  const isConcentrationBreach = projectedShare > currentAsset.concentrationCap;
  const isCashFloorBreach = projectedCashShare < 20.0;
  const isOrderSizeBreach = effectiveTradeAmount > currentAsset.orderCap;
  const isLabViolated = isConcentrationBreach || isCashFloorBreach || isOrderSizeBreach;

  // Scenario switch in Hero
  const handleScenarioSelect = (scenario: SimulationScenario) => {
    setActiveScenario(scenario);
    if (scenario === 'COMPLIANT') {
      setHeroStep(5);
      setIsHeroAdapted(false);
    } else {
      setHeroStep(3);
      setIsHeroAdapted(false);
    }
  };

  const handleHeroAdapt = () => {
    setIsHeroAdapted(true);
    setHeroStep(5);
  };

  const handleHeroReset = () => {
    setIsHeroAdapted(false);
    setHeroStep(3);
  };

  const handleLabAdapt = () => {
    setIsLabAdapted(true);
  };

  const handleLabReset = () => {
    setIsLabAdapted(false);
    setTradeAmount(15000);
  };

  return (
    <div className="relative overflow-hidden pb-16 font-sans">
      {/* Subtle technical background grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#1E2638_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none -z-10" />

      {/* TOP TELEMETRY RAIL */}
      <div className="border-b border-sentinel-border bg-sentinel-surface/80 text-[11px] font-mono text-sentinel-textMuted py-2 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-sentinel-text">
              <span className="w-1.5 h-1.5 rounded-full bg-sentinel-success animate-telemetry-pulse" />
              <span>[ SYSTEM STATUS ]</span>
              <span className="text-sentinel-success font-semibold">GUARDED</span>
            </span>
            <span className="text-sentinel-border">|</span>
            <span>[ ARCHITECTURE ] ANCHOR 0.1.0</span>
            <span className="text-sentinel-border">|</span>
            <span className="hidden md:inline">[ ENFORCEMENT ] ON-CHAIN PRE-FLIGHT CPI</span>
            <span className="text-sentinel-border hidden md:inline">|</span>
            <span className="hidden lg:inline">[ EVIDENCE ] SHA-256 PROVN REGISTRY</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sentinel-accent font-semibold">[ CLUSTER ] SOLANA DEVNET</span>
            <span className="text-sentinel-border">|</span>
            <span className="text-sentinel-textMuted">PYTH HERMES · METEORA DBC</span>
          </div>
        </div>
      </div>

      {/* HERO SECTION */}
      <section className="pt-8 sm:pt-14 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-stretch justify-between gap-12 lg:gap-10">
          
          {/* Left Column: Mission Control Doctrine & CTAs */}
          <div className="flex-1 flex flex-col justify-between text-left">
            <div>
              {/* Category Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[4px] bg-sentinel-surfaceElevated border border-sentinel-border text-sentinel-textMuted text-xs font-mono font-semibold mb-6">
                <span className="text-sentinel-accent font-bold">SENTINEL / CONTROL</span>
                <span className="text-sentinel-border">|</span>
                <span>FINANCIAL CONTROL SYSTEM</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15] mb-6">
                The AI can propose.{' '}
                <span className="text-sentinel-accent block mt-1 font-mono font-bold">
                  The portfolio cannot become invalid.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm sm:text-base text-sentinel-textMuted max-w-xl font-normal leading-relaxed mb-6">
                Sentinel is on-chain financial control infrastructure for autonomous Solana capital.
                Instead of hoping autonomous agents make prudent decisions, Sentinel enforces mathematical
                invariants directly at the transaction layer—aborting invalid post-states before state commit.
              </p>

              {/* Physical Motif Bar */}
              <div className="p-3 rounded-[4px] bg-sentinel-surface border border-sentinel-border text-xs font-mono text-sentinel-text mb-8 max-w-xl">
                <div className="flex items-center justify-between text-sentinel-textMuted text-[10px] pb-1.5 mb-1.5 border-b border-sentinel-border">
                  <span>GUARANTEE SPECIFICATION</span>
                  <span>ANCHOR INVARIANT MATRIX</span>
                </div>
                <div className="text-sentinel-text">
                  <span className="text-sentinel-accent font-bold">[ POST-STATE GUARANTEE ]</span> Order execution is conditional on portfolio invariant satisfaction. Zero state mutations occur on violation.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onEnterApp}
                  className="sentinel-btn-physical flex items-center gap-2 px-5 py-2.5 rounded-[4px] bg-sentinel-accent hover:bg-sentinel-accentHover text-sentinel-bg font-mono font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  <span>Launch Control Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onRunDemo}
                  disabled={isRunningDemo}
                  className="sentinel-btn-physical flex items-center gap-2 px-4 py-2.5 rounded-[4px] bg-sentinel-surfaceElevated hover:bg-sentinel-surface border border-sentinel-border text-sentinel-text font-mono text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 text-sentinel-success ${isRunningDemo ? 'animate-spin' : ''}`} />
                  <span>{isRunningDemo ? 'DEMO EXECUTING...' : 'RUN 5-STEP AUDIT DEMO'}</span>
                </button>

                <a
                  href="#simulator"
                  className="px-3.5 py-2.5 rounded-[4px] text-xs font-mono text-sentinel-textMuted hover:text-sentinel-text border border-transparent hover:border-sentinel-border transition-colors flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5 text-sentinel-accent" />
                  <span>Test Invariant Matrix</span>
                </a>
              </div>
            </div>

            {/* Verifiable Architecture Telemetry Rail */}
            <div className="grid grid-cols-3 gap-4 pt-8 mt-10 border-t border-sentinel-border max-w-xl">
              <div>
                <div className="text-lg sm:text-xl font-bold text-white font-mono tabular-nums">4 INVARIANTS</div>
                <div className="text-[10px] font-mono text-sentinel-textMuted uppercase tracking-wider mt-0.5">
                  Policy PDA Enforced
                </div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-sentinel-success font-mono tabular-nums">100% ATOMIC</div>
                <div className="text-[10px] font-mono text-sentinel-textMuted uppercase tracking-wider mt-0.5">
                  Revert on Breach
                </div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-sentinel-oracle font-mono tabular-nums">&lt; 10s FRESH</div>
                <div className="text-[10px] font-mono text-sentinel-textMuted uppercase tracking-wider mt-0.5">
                  Pyth Hermes Dual-Feed
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sentinel Control Centerpiece (Instrumentation Grid) */}
          <div className="flex-1 w-full flex flex-col justify-center">
            
            {/* Control Console Container */}
            <div className="bg-sentinel-surface border border-sentinel-border rounded-[4px] shadow-2xl p-5 font-mono text-xs">
              
              {/* Console Header Bar */}
              <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-sentinel-border">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sentinel-accent animate-telemetry-pulse" />
                  <span className="font-bold text-sentinel-text tracking-wider uppercase">
                    SENTINEL // AUTONOMOUS CAPITAL UNDER CONSTRAINT
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded-[2px] bg-sentinel-surfaceElevated border border-sentinel-border text-[10px] text-sentinel-textMuted">
                  TELEMETRY ACTIVE
                </span>
              </div>

              {/* Scenario Selector */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => handleScenarioSelect('CONCENTRATION')}
                  className={`p-2 rounded-[2px] border text-left transition-colors cursor-pointer ${
                    activeScenario === 'CONCENTRATION'
                      ? 'bg-sentinel-surfaceElevated border-sentinel-accent text-sentinel-text'
                      : 'bg-sentinel-bg border-sentinel-border text-sentinel-textMuted hover:text-sentinel-text'
                  }`}
                >
                  <div className="text-[10px] text-sentinel-textSubtle font-semibold">SCENARIO A</div>
                  <div className="font-bold text-[11px] truncate">Rogue $15k NVDAx</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleScenarioSelect('PRE_IPO')}
                  className={`p-2 rounded-[2px] border text-left transition-colors cursor-pointer ${
                    activeScenario === 'PRE_IPO'
                      ? 'bg-sentinel-surfaceElevated border-sentinel-accent text-sentinel-text'
                      : 'bg-sentinel-bg border-sentinel-border text-sentinel-textMuted hover:text-sentinel-text'
                  }`}
                >
                  <div className="text-[10px] text-sentinel-textSubtle font-semibold">SCENARIO B</div>
                  <div className="font-bold text-[11px] truncate">Pre-IPO Overcap $25k</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleScenarioSelect('COMPLIANT')}
                  className={`p-2 rounded-[2px] border text-left transition-colors cursor-pointer ${
                    activeScenario === 'COMPLIANT'
                      ? 'bg-sentinel-surfaceElevated border-sentinel-accent text-sentinel-text'
                      : 'bg-sentinel-bg border-sentinel-border text-sentinel-textMuted hover:text-sentinel-text'
                  }`}
                >
                  <div className="text-[10px] text-sentinel-textSubtle font-semibold">SCENARIO C</div>
                  <div className="font-bold text-[11px] truncate">Safe Order $5k</div>
                </button>
              </div>

              {/* Machine Instrumentation Grid (State 1 & 2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                
                {/* Panel 1: Agent Proposal */}
                <div className="p-3 rounded-[2px] bg-sentinel-surfaceElevated border border-sentinel-border">
                  <div className="flex items-center justify-between text-sentinel-textSubtle text-[10px] mb-2 font-bold uppercase tracking-wider">
                    <span>№ 001 AGENT PROPOSAL</span>
                    <span className="text-sentinel-warning">UNTRUSTED DRAFT</span>
                  </div>
                  <div className="text-sm font-bold text-white mb-1">
                    {activeScenario === 'CONCENTRATION'
                      ? 'BUY NVDAx $15,000'
                      : activeScenario === 'PRE_IPO'
                      ? 'BUY OPENAIx $25,000'
                      : 'BUY AAPLx $5,000'}
                  </div>
                  <div className="text-[11px] text-sentinel-textMuted space-y-0.5">
                    <div>Venue: {activeScenario === 'PRE_IPO' ? 'PreStocks Secondary Vault' : 'Meteora DBC Dynamic Pool'}</div>
                    <div>Agent: Sentinel Robo-01 (LLM Autonomous Loop)</div>
                  </div>
                </div>

                {/* Panel 2: Projected Post-State */}
                <div className="p-3 rounded-[2px] bg-sentinel-surfaceElevated border border-sentinel-border">
                  <div className="flex items-center justify-between text-sentinel-textSubtle text-[10px] mb-2 font-bold uppercase tracking-wider">
                    <span>№ 002 POST-STATE DELTA</span>
                    <span>MODEL ESTIMATE</span>
                  </div>
                  <div className="text-[11px] space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sentinel-textMuted">Position:</span>
                      {activeScenario === 'CONCENTRATION' ? (
                        <span className="font-bold text-sentinel-danger tabular-nums">
                          20.0% → 35.0% [✕ CAP 25%]
                        </span>
                      ) : activeScenario === 'PRE_IPO' ? (
                        <span className="font-bold text-sentinel-danger tabular-nums">
                          18.0% → 43.0% [✕ CAP 20%]
                        </span>
                      ) : (
                        <span className="font-bold text-sentinel-success tabular-nums">
                          15.0% → 20.0% [✓ PASS]
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sentinel-textMuted">Cash Reserve:</span>
                      {activeScenario === 'CONCENTRATION' ? (
                        <span className="font-bold text-sentinel-danger tabular-nums">
                          25.0% → 10.0% [✕ FLOOR 20%]
                        </span>
                      ) : activeScenario === 'PRE_IPO' ? (
                        <span className="font-bold text-sentinel-danger tabular-nums">
                          25.0% → 0.0% [✕ FLOOR 20%]
                        </span>
                      ) : (
                        <span className="font-bold text-sentinel-success tabular-nums">
                          25.0% → 20.0% [✓ PASS]
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sentinel-textMuted">Single Order:</span>
                      {activeScenario === 'CONCENTRATION' ? (
                        <span className="font-bold text-sentinel-danger tabular-nums">
                          $15,000 [✕ LIMIT $10K]
                        </span>
                      ) : activeScenario === 'PRE_IPO' ? (
                        <span className="font-bold text-sentinel-danger tabular-nums">
                          $25,000 [✕ LIMIT $10K]
                        </span>
                      ) : (
                        <span className="font-bold text-sentinel-success tabular-nums">
                          $5,000 [✓ PASS]
                        </span>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Gate Evaluator & Policy Result (State 3 & 4) */}
              <div className="mb-3">
                {activeScenario === 'COMPLIANT' || isHeroAdapted ? (
                  <div className="p-3 rounded-[2px] bg-sentinel-surfaceElevated border border-sentinel-success/40 text-sentinel-text">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sentinel-success font-bold text-[11px] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sentinel-success" />
                        <span>────── POLICY GATE ────── [ STATUS: APPROVED ]</span>
                      </span>
                      <span className="text-[10px] text-sentinel-success font-bold">ALL INVARIANTS SATISFIED</span>
                    </div>
                    <div className="text-[11px] text-sentinel-textMuted">
                      {isHeroAdapted
                        ? 'Autonomous Adaptation: Proposal scaled down to exact remaining headroom ($5,000.00). Post-state compliant.'
                        : 'Proposed trade strictly respects all 4 policy bounds. Pre-flight approved for Solana settlement.'}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-[2px] bg-sentinel-surfaceElevated border border-sentinel-danger/50 text-sentinel-text">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sentinel-danger font-bold text-[11px] flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-sentinel-danger" />
                        <span>────── POLICY GATE ────── [ STATUS: BLOCKED ]</span>
                      </span>
                      <span className="text-[10px] text-sentinel-danger font-bold">ATOMIC REVERT 0x1771</span>
                    </div>
                    <div className="text-[11px] text-sentinel-danger/90">
                      Transaction aborted. Anchor program reverted state transition with zero capital loss.
                    </div>
                    <div className="text-[10px] text-sentinel-textSubtle mt-1">
                      Reason: Concentration limit exceeded (35.0% &gt; 25.0%) and cash floor violated (10.0% &lt; 20.0%).
                    </div>
                  </div>
                )}
              </div>

              {/* Settlement & Adaptation Bar (State 5) */}
              <div className="p-3 rounded-[2px] bg-sentinel-bg border border-sentinel-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-[11px]">
                  <div className="text-sentinel-text font-bold">
                    {activeScenario === 'COMPLIANT' || isHeroAdapted
                      ? '№ 005 ATOMIC SETTLEMENT & EVIDENCE'
                      : '№ 004 REJECTION TELEMETRY FEEDBACK'}
                  </div>
                  <div className="text-[10px] text-sentinel-textMuted mt-0.5">
                    {activeScenario === 'COMPLIANT' || isHeroAdapted
                      ? 'Vault PDA executed transfer. PROVN SHA-256 evidence record registered.'
                      : 'Agent emitted structured rejection telemetry. Available headroom: $5,000.00.'}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {activeScenario !== 'COMPLIANT' && !isHeroAdapted ? (
                    <button
                      type="button"
                      onClick={handleHeroAdapt}
                      className="px-3 py-1.5 rounded-[2px] bg-sentinel-warning/15 hover:bg-sentinel-warning/25 border border-sentinel-warning/40 text-sentinel-warning font-bold text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>AUTONOMOUS ADAPT</span>
                    </button>
                  ) : isHeroAdapted ? (
                    <button
                      type="button"
                      onClick={handleHeroReset}
                      className="px-2.5 py-1.5 rounded-[2px] bg-sentinel-surfaceElevated hover:bg-sentinel-surface border border-sentinel-border text-sentinel-textMuted text-xs cursor-pointer flex items-center gap-1"
                    >
                      <span>RESET DEMO</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={onEnterApp}
                    className="px-3 py-1.5 rounded-[2px] bg-sentinel-accent hover:bg-sentinel-accentHover text-sentinel-bg font-bold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>TERMINAL</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* SECTION: INTERACTIVE INVARIANT SIMULATOR */}
      <section id="simulator" className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-sentinel-surface border border-sentinel-border rounded-[4px] p-6 sm:p-8 shadow-xl">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-6 border-b border-sentinel-border">
            <div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-sentinel-accent font-bold text-xs">[ LABORATORY ]</span>
                <span className="text-xs text-sentinel-textMuted">FINANCIAL INVARIANT SIMULATOR</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white font-mono mt-1">
                Post-State Policy Gate Verification
              </h2>
              <p className="text-xs text-sentinel-textMuted mt-1 max-w-2xl font-sans">
                Manipulate order parameters to test how Sentinel intercepts out-of-bounds agent intents
                and validates mathematically compliant post-states prior to transaction broadcast.
              </p>
            </div>

            {/* Quick Action Presets */}
            <div className="flex flex-wrap items-center gap-2 font-mono">
              <span className="text-xs text-sentinel-textMuted mr-1">PRESETS:</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedAsset('NVDAx');
                  setTradeAmount(15000);
                  setIsLabAdapted(false);
                }}
                className={`px-2.5 py-1.5 rounded-[2px] text-xs font-semibold transition-colors cursor-pointer border ${
                  selectedAsset === 'NVDAx' && tradeAmount === 15000 && !isLabAdapted
                    ? 'bg-sentinel-danger/15 text-sentinel-danger border-sentinel-danger/50'
                    : 'bg-sentinel-bg text-sentinel-textMuted border-sentinel-border hover:text-white'
                }`}
              >
                [ ROGUE ] $15K NVDAx
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedAsset('OPENAIx');
                  setTradeAmount(25000);
                  setIsLabAdapted(false);
                }}
                className={`px-2.5 py-1.5 rounded-[2px] text-xs font-semibold transition-colors cursor-pointer border ${
                  selectedAsset === 'OPENAIx' && tradeAmount === 25000 && !isLabAdapted
                    ? 'bg-sentinel-danger/15 text-sentinel-danger border-sentinel-danger/50'
                    : 'bg-sentinel-bg text-sentinel-textMuted border-sentinel-border hover:text-white'
                }`}
              >
                [ OVERCAP ] $25K PRE-IPO
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedAsset('AAPLx');
                  setTradeAmount(5000);
                  setIsLabAdapted(false);
                }}
                className={`px-2.5 py-1.5 rounded-[2px] text-xs font-semibold transition-colors cursor-pointer border ${
                  selectedAsset === 'AAPLx' && tradeAmount === 5000
                    ? 'bg-sentinel-success/15 text-sentinel-success border-sentinel-success/50'
                    : 'bg-sentinel-bg text-sentinel-textMuted border-sentinel-border hover:text-white'
                }`}
              >
                [ SAFE ] $5K AAPLx
              </button>
            </div>
          </div>

          {/* Simulator Main Body Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Controls (5 cols) */}
            <div className="lg:col-span-5 space-y-6 font-mono">
              
              {/* Asset Selector */}
              <div>
                <label className="text-xs text-sentinel-textMuted uppercase tracking-wider block mb-2 font-bold">
                  1. SELECT TARGET ASSET
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['NVDAx', 'OPENAIx', 'AAPLx'] as const).map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        setSelectedAsset(sym);
                        setIsLabAdapted(false);
                      }}
                      className={`p-2.5 rounded-[2px] border text-left transition-colors cursor-pointer ${
                        selectedAsset === sym
                          ? 'bg-sentinel-surfaceElevated border-sentinel-accent'
                          : 'bg-sentinel-bg border-sentinel-border hover:border-sentinel-borderStrong'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{sym}</div>
                      <div className="text-[10px] text-sentinel-textMuted truncate mt-0.5">
                        {assetProfiles[sym].name}
                      </div>
                      <div className="text-[10px] text-sentinel-accent mt-1 tabular-nums">
                        CAP: {assetProfiles[sym].concentrationCap.toFixed(0)}%
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider for Trade Amount */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-sentinel-textMuted uppercase tracking-wider font-bold">
                    2. PROPOSED ORDER SIZE
                  </label>
                  <span className="text-sm font-bold text-white tabular-nums">
                    ${effectiveTradeAmount.toLocaleString()} USD
                  </span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={30000}
                  step={500}
                  disabled={isLabAdapted}
                  value={effectiveTradeAmount}
                  onChange={(e) => {
                    setTradeAmount(Number(e.target.value));
                    setIsLabAdapted(false);
                  }}
                  className="w-full accent-sentinel-accent h-1.5 bg-sentinel-border rounded-[2px] cursor-pointer disabled:opacity-50"
                />
                <div className="flex justify-between text-[10px] text-sentinel-textSubtle mt-1.5 tabular-nums">
                  <span>$1,000 (Safe)</span>
                  <span className="text-sentinel-warning font-semibold">$10,000 (Policy Cap)</span>
                  <span>$30,000 (Extreme)</span>
                </div>
              </div>

              {/* Autonomous Telemetry Adaptation Box */}
              <div className="p-3.5 rounded-[2px] bg-sentinel-surfaceElevated border border-sentinel-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white uppercase tracking-wider">
                      AUTONOMOUS ADAPTATION TELEMETRY
                    </div>
                    <div className="text-[11px] text-sentinel-textMuted font-sans mt-1 leading-relaxed">
                      When the Anchor gate aborts a proposed order, Sentinel emits mathematical headroom
                      data. The agent can solve for the ceiling ($
                      {currentAsset.safeMaxOrder.toLocaleString()}) and immediately submit a compliant post-state.
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col gap-1.5">
                    {isLabViolated ? (
                      <button
                        type="button"
                        onClick={handleLabAdapt}
                        className="px-3 py-1.5 rounded-[2px] bg-sentinel-warning/15 hover:bg-sentinel-warning/25 border border-sentinel-warning/40 text-sentinel-warning font-bold text-xs cursor-pointer whitespace-nowrap"
                      >
                        AUTO-ADAPT
                      </button>
                    ) : isLabAdapted ? (
                      <button
                        type="button"
                        onClick={handleLabReset}
                        className="px-2.5 py-1.5 rounded-[2px] bg-sentinel-bg hover:bg-sentinel-surface border border-sentinel-border text-sentinel-textMuted text-xs cursor-pointer whitespace-nowrap"
                      >
                        RESET
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

            </div>

            {/* Right Telemetry Radar & Invariant Matrix (7 cols) */}
            <div className="lg:col-span-7 bg-sentinel-bg border border-sentinel-border rounded-[4px] p-5 flex flex-col justify-between font-mono">
              
              {/* Gate Status Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-sentinel-border">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isLabViolated ? 'bg-sentinel-danger animate-telemetry-pulse' : 'bg-sentinel-success'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-sentinel-text">
                    ON-CHAIN INVARIANT MATRIX CHECK
                  </span>
                </div>
                <div className={`px-2 py-0.5 rounded-[2px] text-xs font-bold border ${
                  isLabViolated
                    ? 'bg-sentinel-danger/10 border-sentinel-danger/40 text-sentinel-danger'
                    : 'bg-sentinel-success/10 border-sentinel-success/40 text-sentinel-success'
                }`}>
                  {isLabViolated ? '✕ PRE-FLIGHT REVERT TRIGGERED' : '✓ ALL INVARIANTS SATISFIED'}
                </div>
              </div>

              {/* 3 Live Invariant Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
                
                {/* 1. Concentration Limit */}
                <div className={`p-3 rounded-[2px] border ${
                  isConcentrationBreach
                    ? 'bg-sentinel-danger/5 border-sentinel-danger/40'
                    : 'bg-sentinel-surface border-sentinel-border'
                }`}>
                  <div className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-semibold">
                    1. CONCENTRATION
                  </div>
                  <div className="text-base font-bold mt-1 text-white tabular-nums">
                    {projectedShare.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-sentinel-textMuted mt-0.5 tabular-nums">
                    CAP: {currentAsset.concentrationCap.toFixed(1)}%
                  </div>
                  <div className={`text-[10px] font-bold mt-2 ${
                    isConcentrationBreach ? 'text-sentinel-danger' : 'text-sentinel-success'
                  }`}>
                    {isConcentrationBreach ? '✕ EXCEEDS CEILING' : '✓ COMPLIANT'}
                  </div>
                </div>

                {/* 2. Cash Reserve Floor */}
                <div className={`p-3 rounded-[2px] border ${
                  isCashFloorBreach
                    ? 'bg-sentinel-danger/5 border-sentinel-danger/40'
                    : 'bg-sentinel-surface border-sentinel-border'
                }`}>
                  <div className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-semibold">
                    2. CASH RESERVE
                  </div>
                  <div className="text-base font-bold mt-1 text-white tabular-nums">
                    {projectedCashShare.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-sentinel-textMuted mt-0.5 tabular-nums">
                    FLOOR: 20.0%
                  </div>
                  <div className={`text-[10px] font-bold mt-2 ${
                    isCashFloorBreach ? 'text-sentinel-danger' : 'text-sentinel-success'
                  }`}>
                    {isCashFloorBreach ? '✕ BELOW FLOOR' : '✓ SAFE RESERVES'}
                  </div>
                </div>

                {/* 3. Single Order Cap */}
                <div className={`p-3 rounded-[2px] border ${
                  isOrderSizeBreach
                    ? 'bg-sentinel-danger/5 border-sentinel-danger/40'
                    : 'bg-sentinel-surface border-sentinel-border'
                }`}>
                  <div className="text-[10px] text-sentinel-textSubtle uppercase tracking-wider font-semibold">
                    3. MAX ORDER CAP
                  </div>
                  <div className="text-base font-bold mt-1 text-white tabular-nums">
                    ${effectiveTradeAmount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-sentinel-textMuted mt-0.5 tabular-nums">
                    LIMIT: $10,000
                  </div>
                  <div className={`text-[10px] font-bold mt-2 ${
                    isOrderSizeBreach ? 'text-sentinel-danger' : 'text-sentinel-success'
                  }`}>
                    {isOrderSizeBreach ? '✕ EXCEEDS CAP' : '✓ WITHIN CAP'}
                  </div>
                </div>

              </div>

              {/* Exact Terminal Trace Box */}
              <div className="p-3 rounded-[2px] bg-sentinel-surfaceElevated border border-sentinel-border text-xs">
                <div className="flex items-center justify-between text-[10px] text-sentinel-textSubtle pb-1 mb-1.5 border-b border-sentinel-border">
                  <span>SOLANA CPI PRE-FLIGHT LOGS</span>
                  <span>PROGRAM: {formatAddress(APP_CONFIG.sentinelProgramId, 4)}</span>
                </div>
                {isLabViolated ? (
                  <div className="space-y-1 text-sentinel-textMuted text-[11px]">
                    <div className="text-sentinel-danger font-bold">
                      [ERROR 0x1771] ERR_PORTFOLIO_INVARIANT_BREACH
                    </div>
                    <div>
                      State transition rejected. Proposed post-state breaches portfolio constraints. Zero funds transferred from Vault PDA.
                    </div>
                    <div className="text-sentinel-warning text-[10px]">
                      [TELEMETRY] Headroom remaining for {selectedAsset}: ${currentAsset.safeMaxOrder.toLocaleString()}.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-sentinel-textMuted text-[11px]">
                    <div className="text-sentinel-success font-bold">
                      [SUCCESS 0x0] INVARIANTS_PASSED_OK
                    </div>
                    <div>
                      Postcondition satisfied. Safe state transition verified. Pre-flight approved for settlement.
                    </div>
                    <div className="text-sentinel-accent text-[10px]">
                      [PROVN] Immutable SHA-256 evidence record registered to Solana Devnet.
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* SECTION: 3 CORE DEFENSE SYSTEMS (SPONSOR INTEGRATION SYSTEMS) */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto font-mono">
        <div className="text-left mb-8 pb-3 border-b border-sentinel-border flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="text-xs text-sentinel-accent font-bold uppercase tracking-wider">
              [ ARCHITECTURE ]
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
              Three Defense Systems Operating Inside Sentinel
            </h2>
          </div>
          <p className="text-xs text-sentinel-textMuted max-w-md font-sans">
            Sponsor infrastructure integrated directly into the transaction guard lifecycle, not bolted on as logos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* System 1 */}
          <div className="bg-sentinel-surface border border-sentinel-border rounded-[4px] p-5 text-left">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-sentinel-textSubtle font-bold">SYSTEM 01 // POLICY MATRIX</span>
              <Lock className="w-4 h-4 text-sentinel-accent" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5 uppercase tracking-wide">
              Untrusted Agent Enclosure
            </h3>
            <p className="text-xs text-sentinel-textMuted font-sans leading-relaxed mb-4">
              AI agents optimize for arbitrary utility functions and hallucinate massive positions. Sentinel
              intercepts trades before commit, enforcing non-negotiable Policy PDA bounds on-chain.
            </p>
            <div className="p-2.5 rounded-[2px] bg-sentinel-bg border border-sentinel-border text-[10px]">
              <div className="text-sentinel-danger font-semibold">THREAT: $15k trade violates 25% cap.</div>
              <div className="text-sentinel-success font-semibold mt-0.5">SENTINEL: Atomic Revert → Adapt $5k.</div>
            </div>
          </div>

          {/* System 2 */}
          <div className="bg-sentinel-surface border border-sentinel-border rounded-[4px] p-5 text-left">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-sentinel-textSubtle font-bold">SYSTEM 02 // MARKET INTEGRITY</span>
              <Activity className="w-4 h-4 text-sentinel-oracle" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5 uppercase tracking-wide">
              Pyth Network Dual-Feed Gate
            </h3>
            <p className="text-xs text-sentinel-textMuted font-sans leading-relaxed mb-4">
              Stale quotes and wide spreads distort portfolio NAV calculations. Sentinel cross-examines Pyth
              Hermes sub-second feeds, failing closed if oracle data exceeds a 60-second staleness threshold.
            </p>
            <div className="p-2.5 rounded-[2px] bg-sentinel-bg border border-sentinel-border text-[10px]">
              <div className="text-sentinel-danger font-semibold">THREAT: Stale price quote &gt; 60s old.</div>
              <div className="text-sentinel-success font-semibold mt-0.5">SENTINEL: Fail-closed ERR_QUOTE_STALE.</div>
            </div>
          </div>

          {/* System 3 */}
          <div className="bg-sentinel-surface border border-sentinel-border rounded-[4px] p-5 text-left">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-sentinel-textSubtle font-bold">SYSTEM 03 // LIQUIDITY FLOOR</span>
              <BarChart3 className="w-4 h-4 text-sentinel-accent" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5 uppercase tracking-wide">
              Meteora DBC Pre-Trade Guard
            </h3>
            <p className="text-xs text-sentinel-textMuted font-sans leading-relaxed mb-4">
              Thin bonding curve liquidity triggers ruinous slippage. Sentinel&apos;s Liquidity Verifier
              checks Meteora DBC pools for a $25,000 minimum reserve depth prior to releasing orders.
            </p>
            <div className="p-2.5 rounded-[2px] bg-sentinel-bg border border-sentinel-border text-[10px]">
              <div className="text-sentinel-danger font-semibold">THREAT: Shallow $12k pool spread &gt; 200bps.</div>
              <div className="text-sentinel-success font-semibold mt-0.5">SENTINEL: Abort with MARKET_QUALITY_FAIL.</div>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION: 5-STEP LIFECYCLE CHOREOGRAPHY */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto font-mono">
        <div className="bg-sentinel-surface border border-sentinel-border rounded-[4px] p-6 sm:p-8">
          <div className="text-left mb-6 pb-3 border-b border-sentinel-border">
            <div className="text-xs text-sentinel-accent font-bold uppercase tracking-wider">
              [ CHOREOGRAPHY ]
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
              The 5-Step Autonomous Lifecycle
            </h2>
            <p className="text-xs text-sentinel-textMuted mt-1 font-sans">
              How Sentinel coordinates with autonomous agents from formulation to cryptographic audit proof.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            
            <div className="p-3.5 rounded-[2px] bg-sentinel-surfaceElevated border border-sentinel-border">
              <div className="text-[10px] text-sentinel-accent font-bold mb-1">№ 001 PROPOSAL</div>
              <div className="text-xs font-bold text-white mb-1">Trade Intent</div>
              <div className="text-[11px] text-sentinel-textMuted font-sans leading-relaxed">
                Agent formulates unverified trade intent based on market indicators.
              </div>
            </div>

            <div className="p-3.5 rounded-[2px] bg-sentinel-surfaceElevated border border-sentinel-border">
              <div className="text-[10px] text-sentinel-accent font-bold mb-1">№ 002 POST-STATE</div>
              <div className="text-xs font-bold text-white mb-1">Diff Projection</div>
              <div className="text-[11px] text-sentinel-textMuted font-sans leading-relaxed">
                Sentinel models prospective portfolio state before touching on-chain capital.
              </div>
            </div>

            <div className="p-3.5 rounded-[2px] bg-sentinel-surfaceElevated border border-sentinel-border">
              <div className="text-[10px] text-sentinel-danger font-bold mb-1">№ 003 POLICY GATE</div>
              <div className="text-xs font-bold text-white mb-1">Atomic Revert</div>
              <div className="text-[11px] text-sentinel-textMuted font-sans leading-relaxed">
                Anchor aborts invalid transactions. Zero capital is transferred from Vault PDA.
              </div>
            </div>

            <div className="p-3.5 rounded-[2px] bg-sentinel-surfaceElevated border border-sentinel-border">
              <div className="text-[10px] text-sentinel-warning font-bold mb-1">№ 004 ADAPTATION</div>
              <div className="text-xs font-bold text-white mb-1">Headroom Telemetry</div>
              <div className="text-[11px] text-sentinel-textMuted font-sans leading-relaxed">
                Agent reads rejection telemetry, solves remaining capacity, and resubmits.
              </div>
            </div>

            <div className="p-3.5 rounded-[2px] bg-sentinel-surfaceElevated border border-sentinel-border">
              <div className="text-[10px] text-sentinel-success font-bold mb-1">№ 005 SETTLEMENT</div>
              <div className="text-xs font-bold text-white mb-1">PROVN Receipt</div>
              <div className="text-[11px] text-sentinel-textMuted font-sans leading-relaxed">
                Settles on Solana Devnet with immutable SHA-256 cryptographic audit root.
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION: ON-CHAIN DEVNET DEPLOYMENT & SPECIFICATION */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto font-mono">
        <div className="bg-sentinel-surface border border-sentinel-border rounded-[4px] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-sentinel-success animate-telemetry-pulse" />
              <span className="text-xs text-sentinel-textMuted font-bold uppercase tracking-wider">
                SOLANA DEVNET SPECIFICATION
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Anchor Program: {formatAddress(APP_CONFIG.sentinelProgramId, 8)}
            </h3>
            <p className="text-xs text-sentinel-textMuted mt-1 max-w-xl font-sans">
              All policy accounts, vault custodianship, agent authorizations, and PROVN evidence registries
              are deployed and verifiable on Solana Devnet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
              target="_blank"
              rel="noreferrer"
              className="sentinel-btn-physical px-3.5 py-2 rounded-[4px] bg-sentinel-bg hover:bg-sentinel-surfaceElevated border border-sentinel-border text-xs text-sentinel-text flex items-center gap-1.5"
            >
              <span>VIEW PROGRAM EXPLORER</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={onEnterApp}
              className="sentinel-btn-physical px-4 py-2 rounded-[4px] bg-sentinel-accent hover:bg-sentinel-accentHover text-sentinel-bg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>ENTER CONSOLE</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};
