import { Connection, PublicKey } from '@solana/web3.js';
import { parsePythPriceUpdateAccount } from '@sentinel/sdk';

export const PYTH_PRICE_UPDATE_DEVNET = new PublicKey('GsZE13nr9acPWUHvpwnajtMzpctFyxfgquNsCnR2P52i');

export interface OraclePriceReading {
  priceCents: number;
  source: 'live_pyth_devnet' | 'controlled_scenario_simulation';
  isLive: boolean;
  isSimulation: boolean;
  publishTime?: number;
  confBps?: number;
}

/**
 * Fetches the live Pyth Devnet price in cents for the configured oracle feed with explicit provenance.
 * In live mode (default), strictly fails closed if Pyth oracle is unavailable, unverified, or stale (> 60s).
 * When explicitSimulation: true is selected, returns explicit controlled scenario simulation.
 */
export async function fetchPythPriceReading(
  connection: Connection,
  options: { explicitSimulation?: boolean } = {}
): Promise<OraclePriceReading> {
  if (options.explicitSimulation) {
    return {
      priceCents: 2500_00,
      source: 'controlled_scenario_simulation',
      isLive: false,
      isSimulation: true,
    };
  }

  try {
    const pythAcc = await connection.getAccountInfo(PYTH_PRICE_UPDATE_DEVNET, 'confirmed');
    if (!pythAcc || !pythAcc.data) {
      throw new Error(`Pyth account ${PYTH_PRICE_UPDATE_DEVNET.toBase58()} not found on Devnet RPC.`);
    }

    const parsed = parsePythPriceUpdateAccount(pythAcc.data);
    const nowSec = Math.floor(Date.now() / 1000);
    const isFresh = parsed.publishTime > 0 && Math.abs(nowSec - parsed.publishTime) <= 60;
    if (!isFresh) {
      throw new Error(
        `Pyth price is stale (publishTime: ${parsed.publishTime}, now: ${nowSec}, age: ${Math.abs(nowSec - parsed.publishTime)}s > 60s ceiling).`
      );
    }

    if (parsed.priceCents <= 0) {
      throw new Error(`Pyth price is non-positive (${parsed.priceCents} cents).`);
    }

    const confBps = parsed.price > BigInt(0) ? Number((parsed.conf * BigInt(10000)) / parsed.price) : 0;
    if (confBps > 200) {
      throw new Error(`Pyth price confidence interval too wide (${confBps} bps > 200 bps ceiling).`);
    }

    return {
      priceCents: parsed.priceCents,
      source: 'live_pyth_devnet',
      isLive: true,
      isSimulation: false,
      publishTime: parsed.publishTime,
      confBps,
    };
  } catch (err: any) {
    throw new Error(
      `Pyth oracle feed unavailable, unverified, or stale on Devnet: ${err?.message || err}. Fails closed in live mode.`
    );
  }
}
