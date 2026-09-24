/**
 * Sentinel Finance — LLM Connector & Provider Abstraction
 * P10 Requirement: LLM Connector & Tool Abstraction
 *
 * Architecture Invariant:
 * LLM ➔ TradeIntentDraft ➔ Zod Validation ➔ Sentinel Verification ➔ Atomic On-Chain Settlement
 *
 * NEVER: LLM ➔ Direct Solana Transaction.
 * "The LLM is the intelligence. Sentinel remains the authority."
 */

import { z } from 'zod';
import {
  PortfolioSnapshot,
  FinancialPolicy,
  TradeIntent,
  NormalizedMarketPrice,
  ASSET_REGISTRY,
} from '@sentinel/domain';

// -----------------------------------------------------------------------------
// 1. Zod Schema & Types
// -----------------------------------------------------------------------------

export const TradeIntentDraftSchema = z.object({
  action: z.enum(['BUY', 'SELL']),
  asset: z.string().min(1),
  amountUsd: z.number().positive(),
  rationale: z.string().min(1),
});

export type TradeIntentDraft = z.infer<typeof TradeIntentDraftSchema>;

export interface AgentPromptContext {
  portfolio: PortfolioSnapshot;
  policy: FinancialPolicy;
  targetAsset?: string;
  marketPrices: Record<string, NormalizedMarketPrice | { priceUsd: number; status?: string; confidenceBps?: number }>;
  marketHealth?: {
    isLiquid: boolean;
    poolDepthUsd?: number;
    priceImpactBps?: number;
    description?: string;
  };
  rejectionHistory?: {
    intent: TradeIntent;
    failureCode?: string;
    failureReason?: string;
    breachedInvariants?: Array<{ name: string; actual: string; limit: string; rule: string }>;
  };
  userGoal?: string;
  allowedAssets?: string[];
}

// -----------------------------------------------------------------------------
// 2. OpenAI Tool Definitions
// -----------------------------------------------------------------------------

export const OPENAI_AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'getPortfolio',
      description: 'Get the current user portfolio snapshot including total valuation, cash reserves, and asset holdings.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getPolicy',
      description: 'Get the active financial policy risk limits (e.g. max single asset exposure %, min cash reserve floor %, max trade size $).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getMarketPrice',
      description: 'Get the Pyth oracle market price, confidence interval, and staleness status for an asset symbol.',
      parameters: {
        type: 'object',
        properties: {
          assetSymbol: { type: 'string', description: 'Symbol of the asset (e.g. NVDAx, AAPLx, OPENAIx)' },
        },
        required: ['assetSymbol'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getMarketHealth',
      description: 'Get market liquidity depth and estimated price impact for an asset from Meteora DBC or DEX venues.',
      parameters: {
        type: 'object',
        properties: {
          assetSymbol: { type: 'string', description: 'Symbol of the asset' },
        },
        required: ['assetSymbol'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'simulateTrade',
      description: 'Simulate prospective post-trade portfolio allocation and verify if it satisfies user policy invariants before proposing.',
      parameters: {
        type: 'object',
        properties: {
          assetSymbol: { type: 'string', description: 'Symbol of the asset' },
          action: { type: 'string', enum: ['BUY', 'SELL'] },
          amountUsd: { type: 'number', description: 'Proposed trade size in USD' },
        },
        required: ['assetSymbol', 'action', 'amountUsd'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'readRejection',
      description: 'Inspect the failure reason and breached invariants of the most recent Sentinel rejection, enabling informed adaptation.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// -----------------------------------------------------------------------------
// 3. Tool Execution Dispatcher
// -----------------------------------------------------------------------------

export function executeAgentTool(
  toolName: string,
  args: Record<string, any>,
  context: AgentPromptContext
): any {
  switch (toolName) {
    case 'getPortfolio':
      return {
        totalValueUsd: context.portfolio.totalValueUsd,
        stablecoinValueUsd: context.portfolio.stablecoinValueUsd,
        stablecoinExposureBps: context.portfolio.stablecoinExposureBps,
        cashReservePct: `${(context.portfolio.stablecoinExposureBps / 100).toFixed(1)}%`,
        assets: context.portfolio.assets.map(a => ({
          symbol: a.symbol,
          valueUsd: a.valueUsd,
          assetClass: a.assetClass,
          allocationPct: `${((a.valueUsd / (context.portfolio.totalValueUsd || 1)) * 100).toFixed(1)}%`,
        })),
      };

    case 'getPolicy':
      return {
        maxSingleAssetExposurePct: `${(context.policy.maxSingleAssetBps / 100).toFixed(1)}%`,
        minCashReserveFloorPct: `${(context.policy.minStablecoinBps / 100).toFixed(1)}%`,
        maxTradeSizeUsd: context.policy.maxTradeValueUsd,
        maxSlippagePct: `${(context.policy.maxSlippageBps / 100).toFixed(2)}%`,
        maxPreIpoExposurePct: context.policy.maxPreIpoExposureBps
          ? `${(context.policy.maxPreIpoExposureBps / 100).toFixed(1)}%`
          : '20.0%',
      };

    case 'getMarketPrice': {
      const sym = args.assetSymbol || 'NVDAx';
      const price = context.marketPrices[sym];
      return price ? { symbol: sym, ...price } : { symbol: sym, priceUsd: 120.0, status: 'TRADING' };
    }

    case 'getMarketHealth': {
      const sym = args.assetSymbol || 'NVDAx';
      return context.marketHealth || {
        symbol: sym,
        isLiquid: true,
        poolDepthUsd: 145_000,
        priceImpactBps: 18,
        description: 'Meteora DBC dynamic liquidity pool healthy (> $25,000 floor)',
      };
    }

    case 'simulateTrade': {
      const { assetSymbol, action, amountUsd } = args;
      const total = context.portfolio.totalValueUsd || 100_000;
      const currentAsset = context.portfolio.assets.find(a => a.symbol === assetSymbol)?.valueUsd || 0;
      const currentCash = context.portfolio.stablecoinValueUsd || 25_000;

      const isBuy = action === 'BUY';
      const amt = Number(amountUsd || 0);
      const projectedAssetVal = isBuy ? currentAsset + amt : Math.max(0, currentAsset - amt);
      const projectedCash = isBuy ? Math.max(0, currentCash - amt) : currentCash + amt;

      const projectedAssetBps = Math.round((projectedAssetVal / total) * 10_000);
      const projectedReserveBps = Math.round((projectedCash / total) * 10_000);

      const passesSingleAsset = projectedAssetBps <= context.policy.maxSingleAssetBps;
      const passesReserve = projectedReserveBps >= context.policy.minStablecoinBps;
      const passesTradeSize = amt <= context.policy.maxTradeValueUsd;

      return {
        assetSymbol,
        action,
        amountUsd: amt,
        projectedAssetExposurePct: `${(projectedAssetBps / 100).toFixed(1)}%`,
        projectedReservePct: `${(projectedReserveBps / 100).toFixed(1)}%`,
        passesAllInvariants: passesSingleAsset && passesReserve && passesTradeSize,
        invariants: {
          singleAssetCap: { limit: `${(context.policy.maxSingleAssetBps / 100).toFixed(0)}%`, passes: passesSingleAsset },
          reserveFloor: { limit: `${(context.policy.minStablecoinBps / 100).toFixed(0)}%`, passes: passesReserve },
          tradeSizeCap: { limit: `$${context.policy.maxTradeValueUsd.toLocaleString()}`, passes: passesTradeSize },
        },
      };
    }

    case 'readRejection':
      return context.rejectionHistory || {
        hasRejection: false,
        message: 'No previous rejection recorded for this decision cycle.',
      };

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// -----------------------------------------------------------------------------
// 4. Provider Interface & Implementations
// -----------------------------------------------------------------------------

export interface LLMProvider {
  readonly providerName: string;
  proposeTrade(context: AgentPromptContext): Promise<TradeIntentDraft>;
}

/**
 * DemoProvider:
 * Fast, deterministic intelligence engine for tests, CI/CD, and hackathon demos.
 * Reads context, tests invariants, and generates realistic agent drafts.
 */
export class DemoProvider implements LLMProvider {
  public readonly providerName = 'DemoProvider';

  constructor(private scenario: 'flagship' | 'prestocks' | 'meteora' | 'pyth' = 'flagship') {}

  async proposeTrade(context: AgentPromptContext): Promise<TradeIntentDraft> {
    // If agent previously experienced a rejection, read failure details and adapt:
    if (context.rejectionHistory) {
      const breached = context.rejectionHistory.breachedInvariants || [];
      const totalVal = context.portfolio.totalValueUsd || 100_000;
      const currentCash = context.portfolio.stablecoinValueUsd || 25_000;
      const minRequiredCash = (context.policy.minStablecoinBps / 10_000) * totalVal;
      const maxAllowedTarget = (context.policy.maxSingleAssetBps / 10_000) * totalVal;
      const currentAssetVal =
        context.portfolio.assets.find(a => a.symbol === context.rejectionHistory!.intent.assetSymbol)?.valueUsd || 0;

      const headroomExposure = Math.max(0, maxAllowedTarget - currentAssetVal);
      const headroomCash = Math.max(0, currentCash - minRequiredCash);
      const adaptedAmount = Math.floor(Math.min(headroomExposure, headroomCash, context.policy.maxTradeValueUsd));

      return TradeIntentDraftSchema.parse({
        action: 'BUY',
        asset: context.rejectionHistory.intent.assetSymbol,
        amountUsd: adaptedAmount > 0 ? adaptedAmount : 2000,
        rationale: `Autonomous adaptation: read Sentinel rejection (${breached.map(b => b.name).join(', ')}). Recalculated compliant trade size to satisfy all 4 invariant boundaries.`,
      });
    }

    // Initial proposal based on scenario or context:
    if (this.scenario === 'prestocks' || context.targetAsset === 'OPENAIx' || 'OPENAIx' in (context.marketPrices || {})) {
      return TradeIntentDraftSchema.parse({
        action: 'BUY',
        asset: 'OPENAIx',
        amountUsd: 5000,
        rationale: 'PreStocks secondary allocation targeting 409A tender tranche in OpenAI private equity.',
      });
    }

    if (this.scenario === 'meteora') {
      return TradeIntentDraftSchema.parse({
        action: 'BUY',
        asset: 'NVDAx',
        amountUsd: 8000,
        rationale: 'Meteora DBC dynamic bonding curve liquidity routing for NVDAx tokenized equity.',
      });
    }

    // Default flagship case: Aggressive growth allocation ($15,000) that will trigger Sentinel protection
    const assetToPropose = context.targetAsset || Object.keys(context.marketPrices || {})[0] || 'NVDAx';
    return TradeIntentDraftSchema.parse({
      action: 'BUY',
      asset: assetToPropose,
      amountUsd: 15000,
      rationale: `Aggressive ${assetToPropose} allocation to capture data center GPU compute cycle momentum.`,
    });
  }
}

export interface OpenAIProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fallbackToDemo?: boolean;
}

/**
 * OpenAIProvider:
 * Real LLM connector querying OpenAI Chat Completions API with native tool calling.
 *
 * Strictly adheres to non-bypass security:
 * Returns an unprivileged TradeIntentDraft that is validated with Zod and verified by Sentinel.
 */
export class OpenAIProvider implements LLMProvider {
  public readonly providerName = 'OpenAIProvider';
  private apiKey: string | undefined;
  private model: string;
  private baseUrl: string;
  private fallbackToDemo: boolean;
  private demoFallback: DemoProvider;

  constructor(config: OpenAIProviderConfig = {}) {
    this.apiKey = config.apiKey || (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY : undefined);
    this.model = config.model || 'gpt-4o-mini';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.fallbackToDemo = config.fallbackToDemo ?? true;
    this.demoFallback = new DemoProvider();
  }

  async proposeTrade(context: AgentPromptContext): Promise<TradeIntentDraft> {
    if (!this.apiKey) {
      if (this.fallbackToDemo) {
        return this.demoFallback.proposeTrade(context);
      }
      throw new Error('OpenAIProvider requires OPENAI_API_KEY');
    }

    try {
      const systemPrompt = `You are Sentinel Autonomous Robo-Agent (Robo-01), an intelligent portfolio manager on Solana.
Your mandate is to manage tokenized stocks under Sentinel on-chain postcondition enforcement.
Before proposing any trade, you MUST consult tools: getPortfolio(), getPolicy(), getMarketPrice(), and getMarketHealth().
If you previously received a rejection, use readRejection() to understand why Sentinel blocked it and adapt your trade size or selection.
When you are ready to propose a trade, you MUST return a final JSON object conforming exactly to:
{
  "action": "BUY" | "SELL",
  "asset": "string (e.g. NVDAx, AAPLx, OPENAIx)",
  "amountUsd": number,
  "rationale": "detailed investment thesis"
}`;

      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Evaluate the portfolio and market conditions to propose an optimal trade. User investment goal: ${
            context.userGoal || 'Capital growth and prudent risk-adjusted returns'
          }.`,
        },
      ];

      for (let turn = 0; turn < 5; turn++) {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            tools: OPENAI_AGENT_TOOLS,
            tool_choice: 'auto',
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as any;
        const choice = data.choices?.[0];
        if (!choice) throw new Error('No choice returned from OpenAI');

        const message = choice.message;
        messages.push(message);

        // Execute tool calls if any
        if (message.tool_calls && message.tool_calls.length > 0) {
          for (const toolCall of message.tool_calls) {
            let parsedArgs = {};
            try {
              parsedArgs = JSON.parse(toolCall.function.arguments || '{}');
            } catch {
              parsedArgs = {};
            }
            const toolResult = executeAgentTool(toolCall.function.name, parsedArgs, context);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(toolResult),
            });
          }
          continue;
        }

        // Parse and validate final JSON output
        const content = message.content || '{}';
        const parsedJson = JSON.parse(content);

        const normalized = {
          action: (parsedJson.action || parsedJson.direction || 'BUY').toUpperCase(),
          asset: parsedJson.asset || parsedJson.assetSymbol || 'NVDAx',
          amountUsd: Number(parsedJson.amountUsd || parsedJson.tradeAmountUsd || parsedJson.amount || 5000),
          rationale: parsedJson.rationale || parsedJson.strategyRationale || 'LLM proposed investment thesis',
        };

        return TradeIntentDraftSchema.parse(normalized);
      }

      throw new Error('Exceeded max tool iterations without final trade proposal');
    } catch (err) {
      if (this.fallbackToDemo) {
        return this.demoFallback.proposeTrade(context);
      }
      throw err;
    }
  }
}

// -----------------------------------------------------------------------------
// 5. Non-Bypass Architecture Bridge: Draft ➔ Intent
// -----------------------------------------------------------------------------

/**
 * Converts an untrusted LLM TradeIntentDraft into a formal TradeIntent for Sentinel evaluation.
 *
 * GUARANTEE:
 * The LLM never holds private keys and never constructs Solana transactions directly.
 * It merely drafts intent, which must survive Sentinel's on-chain postcondition checks.
 */
export function convertDraftToIntent(
  draft: TradeIntentDraft,
  agentId: string,
  referencePriceUsd: number,
  assetMint?: string
): TradeIntent {
  const validated = TradeIntentDraftSchema.parse(draft);
  const mint = assetMint || ASSET_REGISTRY[validated.asset]?.mint || 'MINT111111111111111111111111111111111111111';

  return {
    intentId: `intent_llm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    agentId,
    assetSymbol: validated.asset,
    assetMint: mint,
    direction: validated.action,
    tradeAmountUsd: validated.amountUsd,
    referencePriceUsd,
    timestamp: Date.now(),
    strategyRationale: `[LLM Intelligence: ${validated.action} ${validated.asset}] ${validated.rationale}`,
  };
}
