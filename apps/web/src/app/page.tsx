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
      client.setAdapter(new LiveExecutionAdapter());
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

  // Run Scripted Hackathon Demo Scenario (Section 17 & 26)
  const handleRunDemo = async () => {
    setIsRunningDemo(true);
    setActiveTab('activity');

    try {
      const agent = client.getAgent();
      const nvdaAsset = portfolio.assets.find(a => a.symbol === 'NVDAx');
      const nvdaMint = nvdaAsset ? nvdaAsset.mint : 'NVDA111111111111111111111111111111111111111';
      const nvdaPyth = marketPrices['NVDAx'];
      const nvdaPrice = nvdaPyth?.priceUsd ?? (nvdaAsset ? nvdaAsset.priceUsd : 120);

      // -----------------------------------------------------------------------
      // Step 1: Autonomous Bad Decision (BUY NVDAx $15,000)
      // -----------------------------------------------------------------------
      const badIntent = agent.proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: nvdaMint,
        direction: 'BUY',
        tradeAmountUsd: 15_000,
        referencePriceUsd: nvdaPrice,
        strategyRationale: 'Increase NVDA exposure aggressively to capture momentum',
      });

      const step1Report = await client.executeDecisionCycle(portfolio, policy, badIntent, nvdaPyth);
      setLatestReport(step1Report);
      setEvidenceList(client.getEvidenceHistory());
      setSelectedEvidenceId(step1Report.evidenceRecord.id);

      // Brief delay so the viewer observes the rejection and reason code
      await new Promise(resolve => setTimeout(resolve, 2400));

      // -----------------------------------------------------------------------
      // Step 2: Agent Auto-adapts to Compliant Trade (BUY NVDAx $5,000)
      // -----------------------------------------------------------------------
      const compliantAmount = agent.calculateCompliantTradeAmount(portfolio, policy, 'NVDAx');

      const adaptedIntent = agent.proposeIntent({
        assetSymbol: 'NVDAx',
        assetMint: nvdaMint,
        direction: 'BUY',
        tradeAmountUsd: compliantAmount,
        referencePriceUsd: nvdaPrice,
        strategyRationale: `Auto-adapted trade size to $${compliantAmount.toLocaleString()} to strictly observe single-asset (25%) and reserve (20%) guarantees`,
      });

      const step2Report = await client.executeDecisionCycle(portfolio, policy, adaptedIntent, nvdaPyth);
      setLatestReport(step2Report);
      setPortfolio(step2Report.resultingPortfolio);
      setEvidenceList(client.getEvidenceHistory());
      setSelectedEvidenceId(step2Report.evidenceRecord.id);
    } finally {
      setIsRunningDemo(false);
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'portfolio' && (
          <PortfolioView
            portfolio={portfolio}
            policy={policy}
            recentEvidence={evidenceList}
            marketPrices={marketPrices}
            onSelectEvidence={handleSelectEvidenceRecord}
            onNavigateToDecisions={() => setActiveTab('activity')}
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
      <footer className="border-t border-sentinel-border bg-sentinel-surface/60 py-6 mt-12">
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
