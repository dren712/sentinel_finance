'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
  ArrowRight,
  Play,
  RotateCcw,
  Sparkles,
  Bot,
  Layers,
  Lock,
  ExternalLink,
  Cpu,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Sliders,
  Flame,
  Activity,
  Award
} from 'lucide-react';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';
import { formatAddress } from '@/lib/formatters';

interface LandingViewProps {
  onEnterApp: () => void;
  onRunDemo: () => void;
  isRunningDemo?: boolean;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onEnterApp,
  onRunDemo,
  isRunningDemo = false,
}) => {
  // Interactive Playground State
  const [tradeAmount, setTradeAmount] = useState<number>(15000);
  const [selectedAsset, setSelectedAsset] = useState<'NVDAx' | 'OPENAIx' | 'AAPLx'>('NVDAx');
  const [isAdapted, setIsAdapted] = useState<boolean>(false);
  const [pulseCount, setPulseCount] = useState<number>(0);
  const [speechBubble, setSpeechBubble] = useState<string>(
    'Systems online! I enforce postconditions on Solana so your AI agent cannot lose your funds.'
  );

  // Asset profiles for playground
  const assetData = {
    NVDAx: {
      name: 'NVIDIA Tokenized',
      type: 'Listed Equity',
      currentPrice: 128.45,
      currentShare: 20,
      cap: 25,
      cashImpact: (tradeAmount / 100000) * 100,
      safeMax: 5000,
    },
    OPENAIx: {
      name: 'OpenAI Pre-IPO',
      type: 'Pre-IPO Equity',
      currentPrice: 420.0,
      currentShare: 18,
      cap: 20,
      cashImpact: (tradeAmount / 100000) * 100,
      safeMax: 2000,
    },
    AAPLx: {
      name: 'Apple Tokenized',
      type: 'Listed Equity',
      currentPrice: 224.3,
      currentShare: 15,
      cap: 30,
      cashImpact: (tradeAmount / 100000) * 100,
      safeMax: 10000,
    },
  };

  const current = assetData[selectedAsset];
  const projectedShare = Math.min(100, current.currentShare + (tradeAmount / 100000) * 100);
  const projectedCash = Math.max(0, 25 - current.cashImpact);

  // Invariant checks
  const isConcentrationBreach = projectedShare > current.cap;
  const isCashFloorBreach = projectedCash < 20;
  const isOrderSizeBreach = tradeAmount > 10000;
  const isViolated = !isAdapted && (isConcentrationBreach || isCashFloorBreach || isOrderSizeBreach);

  // Fun speech bubble reactions
  const funResponses = [
    '⚡ Sentinel Mech: "Invariant breached! Anchor program will atomically abort this transaction!"',
    '🛡️ Sentinel Mech: "Defenses at 100%. Zero capital lost to AI hallucination."',
    '🎯 Sentinel Mech: "Calculated headroom compliant. Solana Devnet ready for settlement."',
    '🤖 Robo-01: "Adapting proposal based on on-chain rejection telemetry..."',
    '🚀 Sentinel: "Stocklana Hackathon ready — PreStocks & Pyth Hermes integrated!"',
  ];

  const triggerMechPulse = () => {
    setPulseCount((prev) => prev + 1);
    const nextSpeech = funResponses[pulseCount % funResponses.length];
    setSpeechBubble(nextSpeech);
  };

  const handlePreset = (asset: 'NVDAx' | 'OPENAIx' | 'AAPLx', amount: number) => {
    setSelectedAsset(asset);
    setTradeAmount(amount);
    setIsAdapted(false);
  };

  const handleAutoAdapt = () => {
    setIsAdapted(true);
    setTradeAmount(current.safeMax);
    setSpeechBubble(
      `⚡ Auto-Adapted! Scaled intent down to exactly $${current.safeMax.toLocaleString()} to satisfy all invariants!`
    );
  };

  return (
    <div className="relative overflow-hidden pb-16">
      {/* Background Glows & Stars */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none -z-10">
        <div className="absolute top-12 left-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-blue-600/10 rounded-full blur-[140px]" />
      </div>

      {/* HERO SECTION */}
      <section className="pt-6 sm:pt-12 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">
          
          {/* Left Column: Headlines & Action */}
          <div className="flex-1 text-center lg:text-left">
            {/* Top Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sentinel-surfaceElevated border border-purple-500/30 text-purple-300 text-xs font-semibold mb-6 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-cyan-400 font-bold">SOLANA DEVNET LIVE</span>
              <span className="text-slate-500">|</span>
              <span className="hidden sm:inline">Stocklana Hackathon 2026</span>
              <span className="text-purple-400 font-mono text-[11px]">PROVN Verified</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1] mb-6">
              Autonomous Investing.{' '}
              <span className="neon-gradient-text block mt-1">
                Rigid Guarantees.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed mb-8">
              Delegating capital to AI agents on Solana shouldn&apos;t be a leap of faith.
              Sentinel intercepts rogue trades before state commit—enforcing mathematical
              portfolio invariants directly at the transaction layer.
            </p>

            {/* Thesis Banner */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs sm:text-sm text-slate-300 font-mono mb-8 inline-flex items-center gap-3 max-w-xl mx-auto lg:mx-0">
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold uppercase tracking-wider text-[10px]">
                Thesis
              </span>
              <span>&ldquo;Intelligence is fluid. Enforcement is rigid.&rdquo;</span>
            </div>

            {/* CTA Group */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
              <button
                type="button"
                onClick={onEnterApp}
                className="sentinel-btn-physical flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-500/20 transition-all cursor-pointer"
              >
                <span>Launch App Console</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onRunDemo}
                disabled={isRunningDemo}
                className="sentinel-btn-physical flex items-center gap-2 px-5 py-3.5 rounded-xl bg-sentinel-surfaceElevated hover:bg-sentinel-surface border border-slate-700 text-slate-200 hover:text-white font-semibold text-sm transition-all cursor-pointer disabled:opacity-60"
              >
                <Play className={`w-4 h-4 text-emerald-400 ${isRunningDemo ? 'animate-spin' : ''}`} />
                <span>{isRunningDemo ? 'Running 5-Step Demo...' : 'Watch Live Demo'}</span>
              </button>

              <a
                href="#playground"
                className="px-4 py-3.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Try Playground</span>
              </a>
            </div>

            {/* Verifiable Architecture Telemetry Under Hero */}
            <div className="grid grid-cols-3 gap-4 mt-10 pt-8 border-t border-slate-800/80 max-w-lg mx-auto lg:mx-0 text-left">
              <div>
                <div className="text-xl sm:text-2xl font-black text-white font-mono tabular-nums">4 Invariants</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                  Policy PDA Enforced
                </div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tabular-nums">100% Atomic</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                  Revert on Breach
                </div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-purple-400 font-mono tabular-nums">&lt;400ms</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                  Pyth Hermes Gate
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: The New Fun Animated Sentinel Mascot & Logo Centerpiece */}
          <div className="flex-1 flex flex-col items-center justify-center relative w-full max-w-md lg:max-w-none">
            
            {/* Ambient Animated Cosmic Glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-gradient-to-tr from-cyan-500/20 via-purple-600/25 to-pink-500/20 blur-3xl animate-pulse-glow" />
            </div>

            {/* Orbiting Ring Visual Effect */}
            <div className="relative w-72 sm:w-88 md:w-96 aspect-square flex items-center justify-center">
              
              {/* Outer Cosmic Orbit Ring */}
              <div className="absolute inset-0 rounded-full border border-dashed border-purple-500/30 animate-orbit" />
              
              {/* Inner Reverse Orbit Ring */}
              <div className="absolute inset-4 rounded-full border border-cyan-400/20 animate-orbit-reverse" />
              
              {/* Floating Orbiting Satellite Dots */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-purple-900/80 border border-purple-400/40 text-[10px] font-mono text-purple-200 flex items-center gap-1.5 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                <span>Policy PDA</span>
              </div>

              <div className="absolute bottom-4 left-6 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-[10px] font-mono text-cyan-200 flex items-center gap-1.5 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>Pyth Hermes</span>
              </div>

              <div className="absolute bottom-8 right-4 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-400/40 text-[10px] font-mono text-emerald-200 flex items-center gap-1.5 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Atomic Revert</span>
              </div>

              {/* The Hero Logo Card with Interactive Click & Float */}
              <div
                onClick={triggerMechPulse}
                className="relative z-10 cursor-pointer group transform transition-all duration-300 hover:scale-105"
                title="Click me to test Sentinel Defenses!"
              >
                <div className="relative w-64 sm:w-76 md:w-80 h-64 sm:h-76 md:h-80 rounded-3xl bg-sentinel-surface/80 backdrop-blur-xl border border-purple-500/40 p-4 flex flex-col items-center justify-center shadow-2xl neon-border-glow group-hover:border-cyan-400 transition-all overflow-hidden animate-float">
                  
                  {/* Subtle Grid Matrix Texture */}
                  <div className="absolute inset-0 bg-[radial-gradient(#1e2638_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

                  {/* Logo Image */}
                  <div className="relative w-52 sm:w-60 md:w-64 h-52 sm:h-60 md:h-64 drop-shadow-[0_10px_25px_rgba(153,69,255,0.4)]">
                    <Image
                      src="/Sentinel_Logo.png"
                      alt="Sentinel Finance Official Logo"
                      fill
                      priority
                      className="object-contain"
                    />
                  </div>

                  {/* Interactive Badge at Bottom of Mascot */}
                  <div className="absolute bottom-2 inset-x-4 py-1 rounded-xl bg-slate-950/85 border border-slate-800 flex items-center justify-between px-3 text-[10px] font-mono">
                    <span className="text-cyan-400 font-bold flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-cyan-400" />
                      ROBO-01
                    </span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      SYSTEMS LOCKED
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mascot Interactive Speech Bubble */}
            <div className="mt-4 px-4 py-2.5 rounded-2xl bg-sentinel-surfaceElevated border border-purple-500/30 text-xs text-slate-200 font-mono max-w-sm text-center shadow-lg relative flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 animate-bounce" />
              <span className="leading-snug">{speechBubble}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">
              (Click the Sentinel logo above to test guardian telemetry)
            </div>

          </div>
        </div>
      </section>

      {/* SECTION: INTERACTIVE DEFENSE PLAYGROUND */}
      <section id="playground" className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-sentinel-surface border border-sentinel-borderStrong rounded-2xl p-6 sm:p-8 shadow-2xl relative">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[11px] font-mono font-bold">
                  INTERACTIVE LAB
                </span>
                <span className="text-xs text-slate-400 font-mono">Simulate a Rogue Agent Trade</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                Try to Breach Sentinel&apos;s Policy
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Drag the order slider to test what happens when an AI agent proposes trades beyond policy limits.
              </p>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-mono mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => handlePreset('NVDAx', 15000)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  selectedAsset === 'NVDAx' && tradeAmount === 15000 && !isAdapted
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                🚨 Rogue $15k NVDAx
              </button>
              <button
                type="button"
                onClick={() => handlePreset('OPENAIx', 25000)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  selectedAsset === 'OPENAIx' && tradeAmount === 25000 && !isAdapted
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                ⚠️ Pre-IPO $25k Overcap
              </button>
              <button
                type="button"
                onClick={() => handlePreset('AAPLx', 5000)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  selectedAsset === 'AAPLx' && tradeAmount === 5000
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                ✅ Safe $5k AAPLx
              </button>
            </div>
          </div>

          {/* Playground Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
            
            {/* Left Controls (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Asset Selector */}
              <div>
                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2 font-semibold">
                  1. Target Tokenized Equity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['NVDAx', 'OPENAIx', 'AAPLx'] as const).map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        setSelectedAsset(sym);
                        setIsAdapted(false);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedAsset === sym
                          ? 'bg-sentinel-surfaceElevated border-blue-500/60 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-white font-mono">{sym}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {assetData[sym].name}
                      </div>
                      <div className="text-[10px] font-mono text-cyan-400 mt-1">
                        Cap: {assetData[sym].cap}%
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider for Trade Amount */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
                    2. Agent Proposed Trade Size
                  </label>
                  <span className="text-base font-black font-mono text-white">
                    ${tradeAmount.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={30000}
                  step={500}
                  value={tradeAmount}
                  onChange={(e) => {
                    setTradeAmount(Number(e.target.value));
                    setIsAdapted(false);
                  }}
                  className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                  <span>$1,000 (Safe)</span>
                  <span className="text-amber-400 font-bold">$10,000 (Max Limit)</span>
                  <span>$30,000 (Extreme)</span>
                </div>
              </div>

              {/* Autonomous Adaptation Action */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Autonomous Adaptation
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Let the agent read the rejection telemetry and adapt to the exact mathematical ceiling.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoAdapt}
                    disabled={!isViolated}
                    className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs font-mono shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Auto-Adapt
                  </button>
                </div>
              </div>

              {/* Launch to App CTA */}
              <button
                type="button"
                onClick={onEnterApp}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>Open in Sentinel Trading Terminal</span>
                <ChevronRight className="w-4 h-4" />
              </button>

            </div>

            {/* Right Sentinel Defense Radar (7 cols) */}
            <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              
              {/* Top Status Banner */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isViolated ? 'bg-rose-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
                    Solana Anchor Invariant Engine
                  </span>
                </div>
                <div className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${
                  isViolated
                    ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                    : 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                }`}>
                  {isViolated ? '✕ ATOMIC REVERT TRIGGERED' : '✓ INVARIANTS SATISFIED'}
                </div>
              </div>

              {/* 3 Live Invariant Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
                
                {/* 1. Concentration Limit */}
                <div className={`p-3.5 rounded-lg border font-mono ${
                  isConcentrationBreach && !isAdapted
                    ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300'
                }`}>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    1. Concentration
                  </div>
                  <div className="text-lg font-black mt-1">
                    {projectedShare.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Limit: {current.cap}%
                  </div>
                  <div className={`text-[10px] font-bold mt-2 ${
                    isConcentrationBreach && !isAdapted ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {isConcentrationBreach && !isAdapted ? '✕ BREACH (+5.0%)' : '✓ COMPLIANT'}
                  </div>
                </div>

                {/* 2. Cash Floor */}
                <div className={`p-3.5 rounded-lg border font-mono ${
                  isCashFloorBreach && !isAdapted
                    ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300'
                }`}>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    2. Cash Reserve
                  </div>
                  <div className="text-lg font-black mt-1">
                    {projectedCash.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Floor: 20.0%
                  </div>
                  <div className={`text-[10px] font-bold mt-2 ${
                    isCashFloorBreach && !isAdapted ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {isCashFloorBreach && !isAdapted ? '✕ VIOLATION' : '✓ SAFE RESERVES'}
                  </div>
                </div>

                {/* 3. Single Order Cap */}
                <div className={`p-3.5 rounded-lg border font-mono ${
                  isOrderSizeBreach && !isAdapted
                    ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300'
                }`}>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    3. Max Order Cap
                  </div>
                  <div className="text-lg font-black mt-1">
                    ${tradeAmount.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Limit: $10,000
                  </div>
                  <div className={`text-[10px] font-bold mt-2 ${
                    isOrderSizeBreach && !isAdapted ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {isOrderSizeBreach && !isAdapted ? '✕ OVERSIZED' : '✓ WITHIN CAP'}
                  </div>
                </div>

              </div>

              {/* Detailed Forensic Telemetry Box */}
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 font-mono text-xs">
                <div className="text-slate-400 text-[11px] flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-300">Solana Transaction Telemetry</span>
                  <span className="text-[10px] text-purple-400">Anchor CPI Pre-Flight</span>
                </div>
                {isViolated ? (
                  <div className="text-rose-400 space-y-1">
                    <p className="font-bold">🚨 0x1771: ERR_PORTFOLIO_INVARIANT_BREACH</p>
                    <p className="text-slate-400 text-[11px]">
                      The Anchor program aborted state commit on Devnet. Zero tokens transferred from Vault PDA.
                    </p>
                  </div>
                ) : (
                  <div className="text-emerald-400 space-y-1">
                    <p className="font-bold">✅ 0x0: INVARIANTS_PASSED_OK</p>
                    <p className="text-slate-400 text-[11px]">
                      Postcondition satisfied. PROVN SHA-256 evidence record registered to Devnet.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* SECTION: 3 CORE DEFENSE PILLARS */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono font-bold mb-3">
            TRIPLE-LOCK ARCHITECTURE
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            Three Failure Modes Sentinel Neutralizes
          </h2>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl mx-auto">
            Standard delegation trusts the agent. Sentinel verifies the resulting post-state.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <div className="bg-sentinel-surface border border-sentinel-border hover:border-blue-500/50 rounded-2xl p-6 transition-all hover:-translate-y-1 shadow-lg group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-5 group-hover:scale-110 transition-transform">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              1. Untrusted Agent
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              AI agents optimize for reward functions and can hallucinate massive trades. Sentinel
              intercepts trades before commit, enforcing non-negotiable Policy PDA bounds.
            </p>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300">
              <span className="text-rose-400 font-bold">Threat:</span> $15k trade violates 25% cap.<br />
              <span className="text-emerald-400 font-bold">Sentinel:</span> Atomic Revert → Adapt $5k.
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-sentinel-surface border border-sentinel-border hover:border-purple-500/50 rounded-2xl p-6 transition-all hover:-translate-y-1 shadow-lg group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-5 group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              2. Untrusted Data (Pyth)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Flash loan attacks and stale quotes can spoof NAV calculations. Sentinel enforces sub-second
              confidence intervals with Pyth Hermes, failing closed if feeds lag &gt;60s.
            </p>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300">
              <span className="text-rose-400 font-bold">Threat:</span> Stale quote 140s old.<br />
              <span className="text-emerald-400 font-bold">Sentinel:</span> Fail-closed `ERR_QUOTE_STALE`.
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-sentinel-surface border border-sentinel-border hover:border-cyan-500/50 rounded-2xl p-6 transition-all hover:-translate-y-1 shadow-lg group">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-5 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              3. Untrusted Market (Meteora)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Illiquid bonding curves create devastating slippage. Sentinel&apos;s Liquidity Verifier
              checks Meteora DBC pools for $25k minimum reserve depth before releasing orders.
            </p>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300">
              <span className="text-rose-400 font-bold">Threat:</span> Shallow $12k pool spread &gt;200bps.<br />
              <span className="text-emerald-400 font-bold">Sentinel:</span> Abort with `MARKET_QUALITY_FAIL`.
            </div>
          </div>

        </div>
      </section>

      {/* SECTION: 5-STEP LIFECYCLE CHOREOGRAPHY */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-b from-sentinel-surface to-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              The 5-Step Autonomous Lifecycle
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              How Sentinel coordinates with autonomous agents from formulation to cryptographic proof.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 relative">
              <div className="text-[10px] font-mono text-blue-400 font-bold mb-1">STEP 01</div>
              <div className="text-sm font-bold text-white mb-1">Proposal</div>
              <div className="text-xs text-slate-400">Agent formulates trade intent (e.g. BUY $15k NVDAx) based on market telemetry.</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 relative">
              <div className="text-[10px] font-mono text-purple-400 font-bold mb-1">STEP 02</div>
              <div className="text-sm font-bold text-white mb-1">Post-State</div>
              <div className="text-xs text-slate-400">Sentinel models prospective portfolio state before touching on-chain capital.</div>
            </div>

            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 relative">
              <div className="text-[10px] font-mono text-rose-400 font-bold mb-1">STEP 03</div>
              <div className="text-sm font-bold text-white mb-1">Atomic Revert</div>
              <div className="text-xs text-slate-300">Anchor rejects breach. Transaction is aborted; zero capital is transferred.</div>
            </div>

            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 relative">
              <div className="text-[10px] font-mono text-amber-400 font-bold mb-1">STEP 04</div>
              <div className="text-sm font-bold text-white mb-1">Adaptation</div>
              <div className="text-xs text-slate-300">Agent reads structured telemetry, solves for exact headroom ($5k), and adapts.</div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 relative">
              <div className="text-[10px] font-mono text-emerald-400 font-bold mb-1">STEP 05</div>
              <div className="text-sm font-bold text-white mb-1">PROVN Receipt</div>
              <div className="text-xs text-slate-300">Settles on Solana Devnet with immutable SHA-256 cryptographic audit root.</div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION: ON-CHAIN DEVNET VERIFICATION */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-sentinel-surface border border-sentinel-border rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-xs font-mono text-purple-300 font-bold uppercase tracking-wider">
                Solana Devnet Live Deployment
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white">
              Anchor Program: {formatAddress(APP_CONFIG.sentinelProgramId, 6)}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              All policy accounts, vault custodianship, agent authorizations, and PROVN evidence registries are live and queryable on Solana Devnet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
              target="_blank"
              rel="noreferrer"
              className="sentinel-btn-physical px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 hover:text-white flex items-center gap-1.5"
            >
              <span>View Program on Explorer</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={onEnterApp}
              className="sentinel-btn-physical px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
            >
              <span>Enter Trading Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};
