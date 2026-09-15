'use client';

import React, { useState, useMemo } from 'react';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  EvidenceRecord,
} from '@sentinel/domain';
import {
  SentinelClient,
  SimulatedExecutionAdapter,
  LiveExecutionAdapter,
  DecisionCycleReport,
} from '@sentinel/sdk';
import { Header } from '@/components/Header';
import { Navigation, NavTab } from '@/components/Navigation';
import { OverviewView } from '@/components/OverviewView';
import { PortfolioView } from '@/components/PortfolioView';
import { AgentView } from '@/components/AgentView';
import { GuaranteesView } from '@/components/GuaranteesView';
import { DecisionsView } from '@/components/DecisionsView';
import { EvidenceView } from '@/components/EvidenceView';
import { SponsorsView } from '@/components/SponsorsView';
import { TransactionModal, TxLifecycleStep, TxDetails } from '@/components/ui/TransactionModal';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';
import { formatAddress } from '@/lib/formatters';

export default function Home() {
  const client = useMemo(() => new SentinelClient(), []);

  const [mode, setMode] = useState<'SIMULATION' | 'LIVE'>('SIMULATION');
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot>(() => client.createDefaultPortfolio());
  const [policy, setPolicy] = useState<FinancialPolicy>(() => client.createDefaultPolicy());
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const [latestReport, setLatestReport] = useState<DecisionCycleReport | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | undefined>(undefined);
  const [isRunningDemo, setIsRunningDemo] = useState(false);
  const [isRunningTrade, setIsRunningTrade] = useState(false);

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
      const price = asset ? asset.priceUsd : 100;

      const intent = client.getAgent().proposeIntent({
        assetSymbol,
        assetMint: mint,
        direction,
        tradeAmountUsd: amountUsd,
        referencePriceUsd: price,
        strategyRationale: `User-directed autonomous intent: ${direction} ${assetSymbol} for $${amountUsd.toLocaleString()}`,
      });

      const report = await client.executeDecisionCycle(portfolio, policy, intent);
      setLatestReport(report);
      setEvidenceList(client.getEvidenceHistory());
      setSelectedEvidenceId(report.evidenceRecord.id);

      if (report.status === 'SETTLED') {
        setPortfolio(report.resultingPortfolio);
      }

      setActiveTab('decisions');
    } finally {
      setIsRunningTrade(false);
    }
  };

  // Run Scripted Hackathon Demo Scenario (Section 17 & 26)
  const handleRunDemo = async () => {
    setIsRunningDemo(true);
    setActiveTab('decisions');

    try {
      const agent = client.getAgent();
      const nvdaAsset = portfolio.assets.find(a => a.symbol === 'NVDAx');
      const nvdaMint = nvdaAsset ? nvdaAsset.mint : 'NVDA111111111111111111111111111111111111111';
      const nvdaPrice = nvdaAsset ? nvdaAsset.priceUsd : 120;

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

      const step1Report = await client.executeDecisionCycle(portfolio, policy, badIntent);
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

      const step2Report = await client.executeDecisionCycle(portfolio, policy, adaptedIntent);
      setLatestReport(step2Report);
      setPortfolio(step2Report.resultingPortfolio);
      setEvidenceList(client.getEvidenceHistory());
      setSelectedEvidenceId(step2Report.evidenceRecord.id);
    } finally {
      setIsRunningDemo(false);
    }
  };

  const handleSelectEvidenceRecord = (record: EvidenceRecord) => {
    setSelectedEvidenceId(record.id);
    setActiveTab('evidence');
  };

  const handleUpdatePolicy = (updated: Partial<FinancialPolicy>) => {
    setPolicy(prev => ({
      ...prev,
      ...updated,
    }));
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

      {/* Primary Navigation Tabs */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        evidenceCount={evidenceList.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <OverviewView
            portfolio={portfolio}
            policy={policy}
            agent={client.getAgent()}
            latestReport={latestReport}
            recentEvidence={evidenceList}
            onNavigateToDecisions={() => setActiveTab('decisions')}
            onNavigateToEvidence={() => setActiveTab('evidence')}
            onNavigateToGuarantees={() => setActiveTab('guarantees')}
            onNavigateToPortfolio={() => setActiveTab('portfolio')}
            onNavigateToAgent={() => setActiveTab('agent')}
            onRunDemo={handleRunDemo}
            isRunningDemo={isRunningDemo}
          />
        )}

        {activeTab === 'portfolio' && (
          <PortfolioView
            portfolio={portfolio}
            policy={policy}
            recentEvidence={evidenceList}
            onSelectEvidence={handleSelectEvidenceRecord}
            onNavigateToDecisions={() => setActiveTab('decisions')}
          />
        )}

        {activeTab === 'agent' && (
          <AgentView
            agent={client.getAgent()}
            portfolio={portfolio}
            policy={policy}
            onExecuteCustomTrade={handleExecuteCustomTrade}
            isRunningTrade={isRunningTrade}
          />
        )}

        {activeTab === 'guarantees' && (
          <GuaranteesView
            policy={policy}
            onUpdatePolicy={handleUpdatePolicy}
          />
        )}

        {activeTab === 'decisions' && (
          <DecisionsView
            latestReport={latestReport}
            policy={policy}
            portfolio={portfolio}
            onSelectEvidenceId={(id) => {
              setSelectedEvidenceId(id);
              setActiveTab('evidence');
            }}
          />
        )}

        {activeTab === 'evidence' && (
          <EvidenceView
            evidenceList={evidenceList}
            selectedEvidenceId={selectedEvidenceId}
            onSelectEvidenceId={setSelectedEvidenceId}
          />
        )}

        {activeTab === 'sponsors' && (
          <SponsorsView agent={client.getAgent()} />
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
