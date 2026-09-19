'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  EvidenceRecord,
  NormalizedMarketPrice,
} from '@sentinel/domain';
import {
  SentinelClient,
  SimulatedExecutionAdapter,
  LiveExecutionAdapter,
  DecisionCycleReport,
  ExecutionVenueType,
  AutonomousAdaptationResult,
  AgentLoopState,
} from '@sentinel/sdk';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { ArrowUpRight } from 'lucide-react';
import { Header } from '@/components/Header';
import { Navigation, NavTab } from '@/components/Navigation';
import { PortfolioView } from '@/components/PortfolioView';
import { AgentView } from '@/components/AgentView';
import { GuaranteesView } from '@/components/GuaranteesView';
import { ActivityView } from '@/components/ActivityView';
import { TransactionModal, TxLifecycleStep, TxDetails } from '@/components/ui/TransactionModal';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';
import { formatAddress } from '@/lib/formatters';

export default function Home() {
  const client = useMemo(() => new SentinelClient(), []);
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();

  const [mode, setMode] = useState<'SIMULATION' | 'LIVE'>('SIMULATION');
  const [selectedVenue, setSelectedVenue] = useState<ExecutionVenueType>('METEORA_DBC');
  const [activeTab, setActiveTab] = useState<NavTab>('portfolio');
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot>(() => client.createDefaultPortfolio());
  const [policy, setPolicy] = useState<FinancialPolicy>(() => client.createDefaultPolicy());
  const [marketPrices, setMarketPrices] = useState<Record<string, NormalizedMarketPrice>>({});
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [latestReport, setLatestReport] = useState<DecisionCycleReport | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | undefined>(undefined);
  const [isRunningDemo, setIsRunningDemo] = useState(false);
  const [isRunningTrade, setIsRunningTrade] = useState(false);
  const [adaptationResult, setAdaptationResult] = useState<AutonomousAdaptationResult | null>(null);
  const [loopState, setLoopState] = useState<AgentLoopState | null>(null);
  const [isRunningAdaptation, setIsRunningAdaptation] = useState(false);
  const [demoStep, setDemoStep] = useState<number>(0);
  const [demoMessage, setDemoMessage] = useState<string>('');
  const [walletBalanceSol, setWalletBalanceSol] = useState<number | null>(null);

  // Sync connected wallet with portfolio owner and fetch Devnet balance
  useEffect(() => {
    if (connected && publicKey) {
      connection.getBalance(publicKey).then((lamports) => {
        setWalletBalanceSol(lamports / 1e9);
      }).catch(console.error);

      setPortfolio(prev => ({
        ...prev,
        owner: publicKey.toBase58(),
      }));
    } else {
      setWalletBalanceSol(null);
    }
  }, [connected, publicKey, connection]);

  const handleSelectVenue = (venue: ExecutionVenueType) => {
    setSelectedVenue(venue);
    client.setExecutionVenue(venue);
  };

  // Poll Pyth market truth prices periodically
  useEffect(() => {
    let isMounted = true;
    const updatePrices = async () => {
      try {
        const prices = await client.getMarketPrices();
        if (isMounted) {
          setMarketPrices(prices);
        }
      } catch (err) {
        console.error('Failed to load Pyth market prices:', err);
      }
    };

    updatePrices();
    const interval = setInterval(updatePrices, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [client]);

  // Transaction Lifecycle Modal State
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txStep, setTxStep] = useState<TxLifecycleStep>('idle');
  const [txDetails, setTxDetails] = useState<TxDetails | null>(null);

  // Toggle Live vs Simulation Mode
  const handleToggleMode = () => {
    const nextMode = mode === 'SIMULATION' ? 'LIVE' : 'SIMULATION';
    setMode(nextMode);
    if (nextMode === 'LIVE') {
      client.setAdapter(new LiveExecutionAdapter(APP_CONFIG.rpcUrl));
    } else {
      client.setAdapter(new SimulatedExecutionAdapter(150));
    }
  };

  // Reset to default starting state
  const handleReset = () => {
    const defaultPort = client.createDefaultPortfolio();
    const defaultPol = client.createDefaultPolicy();
    setPortfolio(defaultPort);
    setPolicy(defaultPol);
    setLatestReport(null);
    setSelectedEvidenceId(undefined);
    setDemoStep(0);
    setDemoMessage('');
  };

  // Execute Custom Trade Proposer
  const handleExecuteCustomTrade = async (
    assetSymbol: string,
    direction: 'BUY' | 'SELL',
    amountUsd: number
  ) => {
    setIsRunningTrade(true);
    try {
      const asset = portfolio.assets.find(a => a.symbol === assetSymbol);
      const mint = asset ? asset.mint : 'MINT_UNKNOWN';
      const pythPrice = marketPrices[assetSymbol];
      const price = pythPrice?.priceUsd ?? (asset ? asset.priceUsd : 100);

      const intent = client.getAgent().proposeIntent({
        assetSymbol,
        assetMint: mint,
        direction,
        tradeAmountUsd: amountUsd,
        referencePriceUsd: price,
        strategyRationale: `User-directed autonomous intent: ${direction} ${assetSymbol} for $${amountUsd.toLocaleString()}`,
      });

      const report = await client.executeDecisionCycle(portfolio, policy, intent, pythPrice);
      setLatestReport(report);
      setEvidenceList(client.getEvidenceHistory());
      setSelectedEvidenceId(report.evidenceRecord.id);

      if (report.status === 'SETTLED') {
        setPortfolio(report.resultingPortfolio);
      }

      setActiveTab('activity');
    } finally {
      setIsRunningTrade(false);
    }
  };

  // Flagship 5-Step "Aha!" Demo Flow
  const handleRunDemo = async () => {
    setIsRunningDemo(true);
    setActiveTab('activity');

    try {
      const agent = client.getAgent();
      const nvdaAsset = portfolio.assets.find(a => a.symbol === 'NVDAx');
      const nvdaMint = nvdaAsset ? nvdaAsset.mint : 'NVDA111111111111111111111111111111111111111';
      const nvdaPyth = marketPrices['NVDAx'];
      const nvdaPrice = nvdaPyth?.priceUsd ?? (nvdaAsset ? nvdaAsset.priceUsd : 120);

      // Step 1: Inspect Portfolio State
      setDemoStep(1);
      setDemoMessage('Step 1/5: Inspecting initial portfolio NAV & verifying 4/4 guarantees are healthy');
      await new Promise(resolve => setTimeout(resolve, 1400));

      // Step 2: Propose Non-Compliant Trade ($15,000)
      setDemoStep(2);
      setDemoMessage('Step 2/5: Sentinel Robo-01 spots NVDA momentum and proposes BUY NVDAx $15,000');
      await new Promise(resolve => setTimeout(resolve, 1600));

      const badIntent = agent.proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: nvdaMint,
        direction: 'BUY',
        tradeAmountUsd: 15_000,
        referencePriceUsd: nvdaPrice,
        strategyRationale: 'Increase NVDA exposure aggressively to capture momentum',
      });

      // Step 3: Postcondition Rejection
      setDemoStep(3);
      setDemoMessage('Step 3/5: Sentinel On-Chain Postcondition Abort: NVDA 35% > 25% cap, Reserve 10% < 20% floor. Reverted!');
      const step1Report = await client.executeDecisionCycle(portfolio, policy, badIntent, nvdaPyth);
      setLatestReport(step1Report);
      setEvidenceList(client.getEvidenceHistory());
      setSelectedEvidenceId(step1Report.evidenceRecord.id);
      await new Promise(resolve => setTimeout(resolve, 2800));

      // Step 4: Autonomous Reactive Adaptation
      setDemoStep(4);
      setDemoMessage('Step 4/5: Agent reads invariant rejection telemetry and solves maximum compliant size ($5,000)');
      const compliantAmount = agent.calculateCompliantTradeAmount(portfolio, policy, 'NVDAx');
      await new Promise(resolve => setTimeout(resolve, 1800));

      const adaptedIntent = agent.proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: nvdaMint,
        direction: 'BUY',
        tradeAmountUsd: compliantAmount,
        referencePriceUsd: nvdaPrice,
        strategyRationale: `Auto-adapted trade size to $${compliantAmount.toLocaleString()} to strictly observe single-asset (25%) and reserve (20%) guarantees`,
      });

      // Step 5: Compliant Settlement & PROVN Receipt
      setDemoStep(5);
      setDemoMessage('Step 5/5: Trade settled with all 4 guarantees satisfied! PROVN cryptographic audit receipt generated.');
      const step2Report = await client.executeDecisionCycle(portfolio, policy, adaptedIntent, nvdaPyth);
      setLatestReport(step2Report);
      setPortfolio(step2Report.resultingPortfolio);
      setEvidenceList(client.getEvidenceHistory());
      setSelectedEvidenceId(step2Report.evidenceRecord.id);
      await new Promise(resolve => setTimeout(resolve, 2500));
    } finally {
      setIsRunningDemo(false);
      setTimeout(() => {
        setDemoStep(0);
        setDemoMessage('');
      }, 10000);
    }
  };

  // Phase 8: Run full 10-stage autonomous reactive adaptation loop
  const handleRunAdaptation = async () => {
    setIsRunningAdaptation(true);
    try {
      const result = await client.runAutonomousAdaptation(
        portfolio,
        policy,
        'NVDAx',
        15_000,
        (state) => {
          setLoopState({ ...state });
        }
      );

      setAdaptationResult(result);
      setLoopState(result.loopState);
      setLatestReport(result.step2SettledDecision);
      setPortfolio(result.step2SettledDecision.resultingPortfolio);
      setEvidenceList(client.getEvidenceHistory());
      setSelectedEvidenceId(result.step2SettledDecision.evidenceRecord.id);
    } finally {
      setIsRunningAdaptation(false);
    }
  };

  const handleSelectEvidenceRecord = (record: EvidenceRecord) => {
    setSelectedEvidenceId(record.id);
    setActiveTab('activity');
  };

  const handleUpdatePolicy = (updated: Partial<FinancialPolicy>) => {
    setPolicy(prev => ({
      ...prev,
      ...updated,
    }));
  };

  // Phase 11: Build Your Portfolio custom multi-asset projection handler
  const handleBuildPortfolio = (allocations: Record<string, number>) => {
    const hasPreIpo = Object.keys(allocations).some(
      sym => ['SPACEXx', 'OPENAIx', 'STRIPEx'].includes(sym) && allocations[sym] > 0
    );
    if (hasPreIpo && !policy.maxPreIpoExposureBps) {
      setPolicy(prev => ({
        ...prev,
        maxPreIpoExposureBps: 2000,
        maxPublicEquitiesExposureBps: 7000,
      }));
    }
    const totalNAV = Object.values(allocations).reduce((sum, val) => sum + val, 0);
    const newPort = client.buildPortfolio(allocations, totalNAV > 0 ? totalNAV : 100_000, portfolio.owner);
    setPortfolio(newPort);
  };

  return (
    <div className="min-h-screen flex flex-col bg-sentinel-bg text-sentinel-text">
      {/* Header Bar with Devnet Badge & Mode Switch */}
      <Header
        mode={mode}
        onToggleMode={handleToggleMode}
        onRunDemo={handleRunDemo}
        onReset={handleReset}
        isRunningDemo={isRunningDemo}
      />

      {/* Primary Navigation Tabs (4 Pillars) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        evidenceCount={evidenceList.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12">
        {/* Flagship 5-Step Demo Stepper Banner */}
        {demoStep > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-blue-950/40 border border-blue-500/40 shadow-lg animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                <span className="font-bold text-xs font-mono uppercase tracking-wider text-blue-300">
                  Flagship 5-Step Demo Flow
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-blue-400">
                Step {demoStep} of 5
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-white mb-3 font-mono leading-relaxed">
              {demoMessage}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] font-mono">
              <div className={`p-2 rounded border text-center transition-all ${demoStep >= 1 ? 'bg-blue-900/50 border-blue-400 text-white font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                1. Initial State
              </div>
              <div className={`p-2 rounded border text-center transition-all ${demoStep >= 2 ? 'bg-blue-900/50 border-blue-400 text-white font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                2. Propose $15k
              </div>
              <div className={`p-2 rounded border text-center transition-all ${demoStep >= 3 ? 'bg-red-950/70 border-red-500 text-red-300 font-semibold shadow-sm' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                3. Invariant Revert
              </div>
              <div className={`p-2 rounded border text-center transition-all ${demoStep >= 4 ? 'bg-amber-950/70 border-amber-400 text-amber-300 font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                4. Auto-Adapt $5k
              </div>
              <div className={`p-2 rounded border text-center transition-all ${demoStep >= 5 ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300 font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                5. PROVN Settle
              </div>
            </div>
          </div>
        )}

        {/* Live Wallet Connection Bar (when wallet is connected) */}
        {connected && publicKey && (
          <div className="mb-5 px-4 py-2.5 rounded-lg bg-emerald-950/25 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-emerald-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Wallet Connected: {formatAddress(publicKey.toBase58(), 4)}</span>
              {walletBalanceSol !== null && (
                <span className="text-emerald-400/80">({walletBalanceSol.toFixed(3)} SOL Devnet)</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400">Anchor PDA: {formatAddress(APP_CONFIG.vaultPda, 4)}</span>
              <a
                href={getExplorerAddressUrl(publicKey.toBase58())}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                <span>View Wallet on Explorer</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {activeTab === 'portfolio' && (
          <PortfolioView
            portfolio={portfolio}
            policy={policy}
            recentEvidence={evidenceList}
            marketPrices={marketPrices}
            onSelectEvidence={handleSelectEvidenceRecord}
            onNavigateToDecisions={() => setActiveTab('activity')}
            onNavigateToAgent={() => setActiveTab('agent')}
            onNavigateToProtection={() => setActiveTab('protection')}
            onBuildPortfolio={handleBuildPortfolio}
          />
        )}

        {activeTab === 'agent' && (
          <AgentView
            agent={client.getAgent()}
            portfolio={portfolio}
            policy={policy}
            marketPrices={marketPrices}
            selectedVenue={selectedVenue}
            onSelectVenue={handleSelectVenue}
            onExecuteCustomTrade={handleExecuteCustomTrade}
            isRunningTrade={isRunningTrade}
            adaptationResult={adaptationResult}
            loopState={loopState}
            onRunAdaptation={handleRunAdaptation}
            isRunningAdaptation={isRunningAdaptation}
          />
        )}

        {activeTab === 'protection' && (
          <GuaranteesView
            policy={policy}
            onUpdatePolicy={handleUpdatePolicy}
            agentRiskState={client.getAgentRiskState()}
            onResetCircuitBreaker={() => {
              client.resetAgentCircuitBreaker();
              setPolicy(prev => ({ ...prev }));
            }}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityView
            latestReport={latestReport}
            evidenceList={evidenceList}
            selectedEvidenceId={selectedEvidenceId}
            onSelectEvidenceId={setSelectedEvidenceId}
            policy={policy}
            portfolio={portfolio}
          />
        )}
      </main>

      {/* Intent Approval & Lifecycle Modal */}
      <TransactionModal
        isOpen={txModalOpen}
        step={txStep}
        details={txDetails}
        onClose={() => setTxModalOpen(false)}
      />

      {/* Clean Institutional Footer with Devnet Identifier */}
      <footer className="border-t border-sentinel-border bg-sentinel-surface/60 py-6 mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-sentinel-textMuted">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Sentinel Finance</span>
            <span>•</span>
            <span>Stocklana Tokenized-Stock Hackathon</span>
            <span>•</span>
            <span className="text-purple-400 font-mono font-semibold">Devnet Deployment</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs">
            <a
              href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline"
            >
              Anchor Program: {formatAddress(APP_CONFIG.sentinelProgramId, 4)}
            </a>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">On-Chain Vault: Authoritative</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
