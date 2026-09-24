'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  EvidenceRecord,
  NormalizedMarketPrice,
  ASSET_REGISTRY,
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
import { Transaction } from '@solana/web3.js';
import { ArrowUpRight } from 'lucide-react';
import { Header } from '@/components/Header';
import { Navigation, NavTab } from '@/components/Navigation';
import { PortfolioView } from '@/components/PortfolioView';
import { HeroStoryCenterpiece, DemoScenarioKey } from '@/components/HeroStoryCenterpiece';
import { AgentView } from '@/components/AgentView';
import { GuaranteesView } from '@/components/GuaranteesView';
import { ActivityView } from '@/components/ActivityView';
import { TransactionModal, TxLifecycleStep, TxDetails } from '@/components/ui/TransactionModal';
import { APP_CONFIG, getExplorerAddressUrl, deriveSentinelDomainPdas } from '@/lib/config';
import { formatAddress } from '@/lib/formatters';

export default function Home() {
  const client = useMemo(() => new SentinelClient(), []);
  const { publicKey, connected, signTransaction, sendTransaction } = useWallet();
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
  const [demoTitle, setDemoTitle] = useState<string>('Flagship 5-Step Demo Flow');
  const [totalDemoSteps, setTotalDemoSteps] = useState<number>(5);
  const [walletBalanceSol, setWalletBalanceSol] = useState<number | null>(null);
  const [selectedHeroScenario, setSelectedHeroScenario] = useState<DemoScenarioKey>('FLAGSHIP');

  const activePdas = useMemo(
    () => deriveSentinelDomainPdas(portfolio.owner, APP_CONFIG.sentinelProgramId),
    [portfolio.owner]
  );

  const pythSourceLabel = useMemo(() => {
    const sample = Object.values(marketPrices)[0];
    if (sample && sample.isSimulation === false) return 'Pyth Hermes Live';
    return mode === 'LIVE' ? 'Pyth Hermes Live' : 'Pyth Benchmark';
  }, [marketPrices, mode]);

  // Hydrate portfolio, policy, and activity history from the server API & Solana RPC
  useEffect(() => {
    const targetWallet = connected && publicKey ? publicKey.toBase58() : 'default';

    fetch(`/api/portfolio/${encodeURIComponent(targetWallet)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.portfolio) {
          setPortfolio(data.portfolio);
        }
      })
      .catch(() => {});

    fetch(`/api/activity/${encodeURIComponent(targetWallet)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.tables?.evidence_index && Array.isArray(data.tables.evidence_index)) {
          setEvidenceList((prev) => (prev.length > 0 ? prev : data.tables.evidence_index));
        }
      })
      .catch(() => {});
  }, [connected, publicKey]);

  // Sync connected wallet with portfolio owner, bind signer, index live on-chain token accounts, and fetch Devnet balance
  useEffect(() => {
    if (connected && publicKey) {
      connection.getBalance(publicKey).then((lamports) => {
        setWalletBalanceSol(lamports / 1e9);
      }).catch(console.error);

      // Bind connection to client indexer
      client.setConnection(connection);

      // Attempt to read live on-chain token accounts from Solana RPC
      client.fetchLiveOnChainPortfolio(publicKey.toBase58()).then((livePort) => {
        if (livePort.assets.length > 0 && livePort.source === 'ON_CHAIN_PROJECTION') {
          setPortfolio(livePort);
        } else {
          // If no token accounts yet on Devnet, maintain demo assets but update owner
          setPortfolio(prev => ({
            ...prev,
            owner: publicKey.toBase58(),
            walletAddress: publicKey.toBase58(),
            source: 'SIMULATED_PROJECTION',
          }));
        }
      }).catch((err) => {
        console.warn('Could not read on-chain token accounts, falling back to simulated:', err);
        setPortfolio(prev => ({
          ...prev,
          owner: publicKey.toBase58(),
          walletAddress: publicKey.toBase58(),
          source: 'SIMULATED_PROJECTION',
        }));
      });

      if (mode === 'LIVE') {
        client.setWalletSigner({
          publicKey,
          signTransaction,
          sendTransaction,
        });
        client.setPythMode('LIVE');
      } else {
        client.setPythMode('BENCHMARK');
      }
    } else {
      setWalletBalanceSol(null);
    }
  }, [connected, publicKey, connection, mode, client, signTransaction, sendTransaction]);

  const handleSelectVenue = (venue: ExecutionVenueType) => {
    setSelectedVenue(venue);
    client.setExecutionVenue(venue);
  };

  // Poll Pyth market truth prices periodically via /api/market/:symbol -> PythLivePriceProvider -> Hermes
  useEffect(() => {
    let isMounted = true;
    const updatePrices = async () => {
      try {
        const res = await fetch(`/api/market/ALL?mode=${mode}`);
        const data = await res.json().catch(() => null);
        if (isMounted && data?.success && data?.prices) {
          setMarketPrices(data.prices);
          return;
        }
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
  }, [client, mode]);

  // Transaction Lifecycle Modal State
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txStep, setTxStep] = useState<TxLifecycleStep>('idle');
  const [txDetails, setTxDetails] = useState<TxDetails | null>(null);

  // Toggle Live vs Simulation Mode
  const handleToggleMode = () => {
    const nextMode = mode === 'SIMULATION' ? 'LIVE' : 'SIMULATION';
    setMode(nextMode);
    client.setPythMode(nextMode === 'LIVE' ? 'LIVE' : 'BENCHMARK');
    if (nextMode === 'LIVE') {
      if (connected && publicKey) {
        client.setWalletSigner({
          publicKey,
          signTransaction,
          sendTransaction,
        });
      } else {
        client.setAdapter(new LiveExecutionAdapter(APP_CONFIG.rpcUrl));
      }
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
    setSelectedHeroScenario('FLAGSHIP');
    setDemoTitle('Flagship 5-Step Demo Flow');
    setTotalDemoSteps(5);
    if (activeTab !== 'portfolio') {
      setActiveTab('activity');
    }

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

  // PreStocks $10K Bounty Demo Flow (Pre-IPO 20% Ceiling Invariant Enforcement)
  const handleRunPreStocksDemo = async () => {
    setIsRunningDemo(true);
    setSelectedHeroScenario('PRESTOCKS');
    setDemoTitle('PreStocks $10K Bounty Demo: Asset-Class Ceiling Enforcement');
    setTotalDemoSteps(5);
    if (activeTab !== 'portfolio') {
      setActiveTab('activity');
    }

    try {
      const effectivePolicy: FinancialPolicy = {
        ...policy,
        maxPreIpoExposureBps: policy.maxPreIpoExposureBps ?? 2000,
      };

      // Step 1: Pre-Flight PreStocks Portfolio State
      setDemoStep(1);
      setDemoMessage('Step 1/5: Inspecting 3-tier portfolio: Public Equity ($57k) + Pre-IPO ($18k / 18.0%) + Stable Reserve ($25k / 25.0%). Pre-IPO cap: ≤ 20.00%');
      await new Promise(resolve => setTimeout(resolve, 1400));

      // Step 2: Propose $5,000 PreStocks Trade (Passes trade sizing cap)
      setDemoStep(2);
      setDemoMessage('Step 2/5: Sentinel Robo-01 proposes BUY OPENAIx $5,000 (Individual trade size $5k ≤ $10k cap PASSES)');
      await new Promise(resolve => setTimeout(resolve, 1600));

      const preStocksResult = await client.runPreStocksDemoScenario(portfolio, effectivePolicy);

      // Step 3: PreStocks Postcondition Invariant Abort (PORTFOLIO_FAILURE)
      setDemoStep(3);
      setDemoMessage('Step 3/5: Sentinel Mode 1 Abort (PORTFOLIO_FAILURE): Pre-IPO allocation surges to 23.0% (> 20.0% policy cap). Reverted atomically with 0 funds lost!');
      setLatestReport(preStocksResult.step1RejectedDecision);
      setEvidenceList(client.getEvidenceHistory());
      setSelectedEvidenceId(preStocksResult.step1RejectedDecision.evidenceRecord.id);
      await new Promise(resolve => setTimeout(resolve, 2800));

      // Step 4: Autonomous Adaptation for PreStocks
      setDemoStep(4);
      setDemoMessage('Step 4/5: Agent solves exact remaining asset-class capacity: ($100k × 20%) - $18k = $2,000 headroom. Auto-adapts proposal to $2,000.');
      await new Promise(resolve => setTimeout(resolve, 1800));

      // Step 5: Settle via PreStocks Secondary Vault
      setDemoStep(5);
      setDemoMessage('Step 5/5: Pre-IPO allocation hits exactly 20.00%! Settled via PreStocks Secondary Vault PDA. PROVN cryptographic audit receipt generated.');
      setLatestReport(preStocksResult.step2SettledDecision);
      setPortfolio(preStocksResult.step2SettledDecision.resultingPortfolio);
      setEvidenceList(client.getEvidenceHistory());
      setSelectedEvidenceId(preStocksResult.step2SettledDecision.evidenceRecord.id);
      await new Promise(resolve => setTimeout(resolve, 2500));
    } finally {
      setIsRunningDemo(false);
      setTimeout(() => {
        setDemoStep(0);
        setDemoMessage('');
      }, 10000);
    }
  };

  // Meteora $5K Bounty Demo Flow (Sentinel Equity Market Guard & DBC Curve Adaptation)
  const handleRunMeteoraDemo = async () => {
    setIsRunningDemo(true);
    setSelectedHeroScenario('METEORA');
    setDemoTitle('Meteora $5K Bounty Demo: Sentinel Equity Market Guard');
    setTotalDemoSteps(5);
    if (activeTab !== 'portfolio') {
      setActiveTab('activity');
    }

    try {
      // Step 1: Inspect Meteora DBC Market
      setDemoStep(1);
      setDemoMessage('Step 1/5: Inspecting Meteora DBC Stock Market for NVDAx (Bonding curve, real reserves, liquidity depth floor)');
      await new Promise(resolve => setTimeout(resolve, 1400));

      // Step 2: Propose Trade with Passing Policy & Exposure
      setDemoStep(2);
      setDemoMessage('Step 2/5: Agent proposes BUY NVDAx $8,000 (User policy $8k ≤ $10k ✓, Portfolio exposure 28% ≤ 30% ✓)');
      await new Promise(resolve => setTimeout(resolve, 1600));

      const meteoraResult = await client.runMeteoraMarketGuardDemoScenario(portfolio, policy);

      // Step 3: Sentinel Market Guard Blocks (MARKET_FAILURE)
      setDemoStep(3);
      setDemoMessage('Step 3/5: Sentinel Mode 2 Abort (MARKET_FAILURE): Estimated DBC price impact is 1.70% (> 1.00% max slippage cap). Execution BLOCKED by Market Guard!');
      setLatestReport(meteoraResult.report);
      setEvidenceList(client.getEvidenceHistory());
      setSelectedEvidenceId(meteoraResult.report.evidenceRecord.id);
      await new Promise(resolve => setTimeout(resolve, 2800));

      // Step 4: Autonomous Adaptation along DBC curve
      setDemoStep(4);
      setDemoMessage('Step 4/5: Agent recomputed along Meteora DBC bonding curve: scaled down to $2,500 where price impact is 0.45% (≤ 1.00% slippage ceiling).');
      await new Promise(resolve => setTimeout(resolve, 1800));

      // Step 5: Settle via Meteora DBC
      setDemoStep(5);
      setDemoMessage('Step 5/5: BUY NVDAx $2,500 Approved & Settled on Meteora DBC Bonding Curve! Zero dislocation execution achieved. PROVN audit receipt sealed.');
      if (meteoraResult.step2AdaptedDecision) {
        setLatestReport(meteoraResult.step2AdaptedDecision);
        setPortfolio(meteoraResult.step2AdaptedDecision.resultingPortfolio);
        setSelectedEvidenceId(meteoraResult.step2AdaptedDecision.evidenceRecord.id);
      }
      setEvidenceList(client.getEvidenceHistory());
      await new Promise(resolve => setTimeout(resolve, 2500));
    } finally {
      setIsRunningDemo(false);
      setTimeout(() => {
        setDemoStep(0);
        setDemoMessage('');
      }, 10000);
    }
  };

  // Pyth Network Bounty Demo Flow (Pyth as a Security Input: Quote Freshness & Pull Update)
  const handleRunPythDemo = async () => {
    setIsRunningDemo(true);
    setSelectedHeroScenario('PYTH');
    setDemoTitle('Pyth Oracle Security Guard: Stale Quote Refusal & Pull Update');
    setTotalDemoSteps(4);
    if (activeTab !== 'portfolio') {
      setActiveTab('activity');
    }

    try {
      // Step 1: Inspect Pyth Market Truth
      setDemoStep(1);
      setDemoMessage('Step 1/4: Inspecting Pyth dual-feed for AAPLx. Oracle quote age is 140s old (exceeds freshness limit of 60s).');
      await new Promise(resolve => setTimeout(resolve, 1400));

      // Step 2: Agent attempts trade on stale feed
      setDemoStep(2);
      setDemoMessage('Step 2/4: Agent proposes BUY AAPLx $4,000. User policy ($4k ≤ $10k) and exposure (29% ≤ 30%) pass.');
      await new Promise(resolve => setTimeout(resolve, 1600));

      // Step 3: Sentinel evaluates: "Is this price trustworthy enough to let the agent act?" -> REJECTED!
      setDemoStep(3);
      setDemoMessage('Step 3/4: Sentinel Mode 3 Abort (DATA_INTEGRITY_FAILURE): "NO EXECUTION: Pyth oracle quote is stale (140s > 60s)". Capital protected from stale market data!');
      const pythResult = await client.runPythSecurityGuardDemoScenario(portfolio, policy);
      setLatestReport(pythResult.step1StaleQuoteDecision);
      setEvidenceList(client.getEvidenceHistory());
      setSelectedEvidenceId(pythResult.step1StaleQuoteDecision.evidenceRecord.id);
      await new Promise(resolve => setTimeout(resolve, 2800));

      // Step 4: Pull Update & Settlement
      setDemoStep(4);
      setDemoMessage('Step 4/4: Pyth Hermès pull update delivers fresh price (age 0s, ±$0.20 confidence). Sentinel verifies integrity & settles trade!');
      setLatestReport(pythResult.step3FreshSettledDecision);
      setPortfolio(pythResult.step3FreshSettledDecision.resultingPortfolio);
      setEvidenceList(client.getEvidenceHistory());
      setSelectedEvidenceId(pythResult.step3FreshSettledDecision.evidenceRecord.id);
      await new Promise(resolve => setTimeout(resolve, 2800));
    } finally {
      setIsRunningDemo(false);
      setTimeout(() => {
        setDemoStep(0);
        setDemoMessage('');
      }, 10000);
    }
  };

  // Phase 8: Run full 10-stage autonomous reactive adaptation loop via POST /api/agent/run
  const handleRunAdaptation = async () => {
    setIsRunningAdaptation(true);
    try {
      const serverRunPromise = fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetSymbol: 'NVDAx',
          initialAmountUsd: 15_000,
        }),
      })
        .then((res) => res.json())
        .catch(() => null);

      const localResult = await client.runAutonomousAdaptation(
        portfolio,
        policy,
        'NVDAx',
        15_000,
        (state) => {
          setLoopState({ ...state });
        }
      );

      const apiResponse = await serverRunPromise;
      const result: AutonomousAdaptationResult =
        apiResponse?.success && apiResponse?.result ? apiResponse.result : localResult;

      setAdaptationResult(result);
      setLoopState(result.loopState);
      setLatestReport(result.step2SettledDecision);
      setPortfolio(
        apiResponse?.resultingPortfolio ?? result.step2SettledDecision.resultingPortfolio
      );

      const targetWallet = connected && publicKey ? publicKey.toBase58() : portfolio.owner || 'default';
      fetch(`/api/activity/${encodeURIComponent(targetWallet)}`)
        .then((res) => res.json())
        .then((actData) => {
          if (actData?.tables?.evidence_index && Array.isArray(actData.tables.evidence_index)) {
            setEvidenceList(actData.tables.evidence_index);
          } else {
            setEvidenceList(client.getEvidenceHistory());
          }
        })
        .catch(() => {
          setEvidenceList(client.getEvidenceHistory());
        });

      setSelectedEvidenceId(result.step2SettledDecision.evidenceRecord.id);
    } finally {
      setIsRunningAdaptation(false);
    }
  };

  const handleHeroRunAdaptation = async () => {
    if (selectedHeroScenario === 'FLAGSHIP') {
      await handleRunDemo();
    } else if (selectedHeroScenario === 'PRESTOCKS') {
      await handleRunPreStocksDemo();
    } else if (selectedHeroScenario === 'METEORA') {
      await handleRunMeteoraDemo();
    } else if (selectedHeroScenario === 'PYTH') {
      await handleRunPythDemo();
    }
  };

  const handleSelectEvidenceRecord = (record: EvidenceRecord) => {
    setSelectedEvidenceId(record.id);
    setActiveTab('activity');
  };

  const handleUpdatePolicy = async (updated: Partial<FinancialPolicy>) => {
    setPolicy((prev) => ({
      ...prev,
      ...updated,
    }));

    const targetWallet =
      connected && publicKey ? publicKey.toBase58() : portfolio.owner || 'default';

    try {
      const res = await fetch(`/api/policy/${encodeURIComponent(targetWallet)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const data = await res.json().catch(() => null);

      // Server prepares an UNSIGNED transaction; browser wallet signs & submits to Solana
      if (
        connected &&
        publicKey &&
        signTransaction &&
        data?.preparedTransaction?.serializedTxBase64
      ) {
        const txBuffer = Buffer.from(data.preparedTransaction.serializedTxBase64, 'base64');
        const unsignedTx = Transaction.from(txBuffer);
        const signedTx = await signTransaction(unsignedTx);
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature, 'confirmed');
      }
    } catch {
      // Wallet declined signature or operating in local preview mode
    }
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
      {/* Header Bar with Actual Source Status & Mode Switch */}
      <Header
        mode={mode}
        portfolioSource={portfolio.source}
        pythSource={pythSourceLabel}
        walletAddress={portfolio.owner}
        onToggleMode={handleToggleMode}
        onRunDemo={handleRunDemo}
        onRunPreStocksDemo={handleRunPreStocksDemo}
        onRunMeteoraDemo={handleRunMeteoraDemo}
        onRunPythDemo={handleRunPythDemo}
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
        {/* Dynamic Demo Stepper Banner */}
        {demoStep > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-blue-950/40 border border-blue-500/40 shadow-lg animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                <span className="font-bold text-xs font-mono uppercase tracking-wider text-blue-300">
                  {demoTitle}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-blue-400">
                Step {demoStep} of {totalDemoSteps}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-white mb-3 font-mono leading-relaxed">
              {demoMessage}
            </p>
            <div className={`grid grid-cols-2 ${totalDemoSteps === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-5'} gap-2 text-[10px] font-mono`}>
              {demoTitle.includes('Pyth') ? (
                <>
                  <div className={`p-2 rounded border text-center transition-all ${demoStep >= 1 ? 'bg-amber-900/50 border-amber-400 text-white font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                    1. Stale Quote (140s)
                  </div>
                  <div className={`p-2 rounded border text-center transition-all ${demoStep >= 2 ? 'bg-amber-900/50 border-amber-400 text-white font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                    2. Propose $4k
                  </div>
                  <div className={`p-2 rounded border text-center transition-all ${demoStep >= 3 ? 'bg-red-950/70 border-red-500 text-red-300 font-semibold shadow-sm' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                    3. Security Refusal
                  </div>
                  <div className={`p-2 rounded border text-center transition-all ${demoStep >= 4 ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300 font-semibold shadow-sm' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                    4. Pull Update & Settle
                  </div>
                </>
              ) : totalDemoSteps === 4 ? (
                <>
                  <div className={`p-2 rounded border text-center transition-all ${demoStep >= 1 ? 'bg-blue-900/50 border-blue-400 text-white font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                    1. DBC Market
                  </div>
                  <div className={`p-2 rounded border text-center transition-all ${demoStep >= 2 ? 'bg-blue-900/50 border-blue-400 text-white font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                    2. Propose $8k
                  </div>
                  <div className={`p-2 rounded border text-center transition-all ${demoStep >= 3 ? 'bg-amber-950/70 border-amber-400 text-amber-300 font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                    3. Liquidity Check
                  </div>
                  <div className={`p-2 rounded border text-center transition-all ${demoStep >= 4 ? 'bg-red-950/70 border-red-500 text-red-300 font-semibold shadow-sm' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                    4. Market Guard Block
                  </div>
                </>
              ) : demoTitle.includes('PreStocks') ? (
                <>
                  <div className={`p-2 rounded border text-center transition-all ${demoStep >= 1 ? 'bg-purple-900/50 border-purple-400 text-white font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                    1. Pre-IPO Universe
                  </div>
                  <div className={`p-2 rounded border text-center transition-all ${demoStep >= 2 ? 'bg-purple-900/50 border-purple-400 text-white font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                    2. Propose $30k
                  </div>
                  <div className={`p-2 rounded border text-center transition-all ${demoStep >= 3 ? 'bg-red-950/70 border-red-500 text-red-300 font-semibold shadow-sm' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                    3. Cap Revert (48% &gt; 20%)
                  </div>
                  <div className={`p-2 rounded border text-center transition-all ${demoStep >= 4 ? 'bg-amber-950/70 border-amber-400 text-amber-300 font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                    4. Auto-Adapt $2k
                  </div>
                  <div className={`p-2 rounded border text-center transition-all ${demoStep >= 5 ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300 font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-500'}`}>
                    5. PreStocks Settle
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
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
                <span className="text-emerald-400/80">
                  ({walletBalanceSol.toFixed(3)} SOL {APP_CONFIG.clusterLabel})
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400">
                Vault PDA: {formatAddress(activePdas.vaultPda, 4)} · Policy PDA: {formatAddress(activePdas.policyPda, 4)}
              </span>
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
            onRunAdaptation={handleHeroRunAdaptation}
            isRunningAdaptation={isRunningAdaptation || isRunningDemo}
            selectedScenario={selectedHeroScenario}
            onSelectScenario={setSelectedHeroScenario}
            demoStep={demoStep}
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

      {/* Clean Institutional Footer with Dynamic Cluster Identifier */}
      <footer className="border-t border-sentinel-border bg-sentinel-surface/60 py-6 mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-sentinel-textMuted">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Sentinel Finance</span>
            <span>•</span>
            <span>Stocklana Tokenized-Stock Hackathon</span>
            <span>•</span>
            <span className="text-purple-400 font-mono font-semibold">
              {APP_CONFIG.clusterLabel} Deployment
            </span>
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
            <span className="text-emerald-400 font-semibold">
              Vault PDA: {formatAddress(activePdas.vaultPda, 4)} (Authoritative)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
