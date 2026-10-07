import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Keypair, PublicKey } from '@solana/web3.js';

export const PYTH_RECEIVER_ID = 'rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ';
export const PROGRAM_ID = '3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH';

export const FIXTURE_NAMES = [
  'valid',
  'wrong-feed',
  'stale',
  'wide-conf',
  'partial-verif',
  'prog-owned',
];

export const FIXTURE_KEYPAIRS = Object.fromEntries(
  FIXTURE_NAMES.map((name) => {
    const seed = crypto
      .createHash('sha256')
      .update('sentinel-price-fixture-' + name)
      .digest();
    return [name, Keypair.fromSeed(seed)];
  })
);

export const FIXTURE_ADDRESSES = Object.fromEntries(
  Object.entries(FIXTURE_KEYPAIRS).map(([name, kp]) => [name, kp.publicKey.toBase58()])
);

/**
 * Builds a serialized PriceUpdateV2 account binary buffer matching Pyth Solana Receiver V2
 */
export function buildPriceUpdateV2Buffer({
  writeAuthority = Keypair.generate().publicKey,
  verificationLevel = 'Full', // 'Full' or { Partial: numSignatures } or 'Partial'
  feedId = Array(32).fill(7),
  price = 12_000n * 1_000_000n, // $120.00 = 12000 cents * 10^6 (for expo -8)
  conf = 50n * 1_000_000n,       // $0.50 = 50 cents * 10^6
  exponent = -8,
  publishTime = Math.floor(Date.now() / 1000),
  prevPublishTime = null,
  emaPrice = null,
  emaConf = null,
  postedSlot = 100n,
}) {
  const disc = Buffer.from([34, 241, 35, 99, 157, 126, 244, 205]);
  const writeAuthPubkey = typeof writeAuthority === 'string' ? new PublicKey(writeAuthority) : writeAuthority;
  const writeAuthBuf = writeAuthPubkey.toBuffer();

  let verifBuf;
  if (verificationLevel === 'Full') {
    verifBuf = Buffer.from([1]);
  } else if (typeof verificationLevel === 'object' && verificationLevel.Partial !== undefined) {
    verifBuf = Buffer.from([0, Number(verificationLevel.Partial)]);
  } else if (verificationLevel === 'Partial') {
    verifBuf = Buffer.from([0, 1]);
  } else {
    throw new Error(`Invalid verificationLevel: ${verificationLevel}`);
  }

  const feedIdBuf = Buffer.from(feedId);
  if (feedIdBuf.length !== 32) {
    throw new Error('feedId must be exactly 32 bytes');
  }

  const priceBuf = Buffer.alloc(8);
  priceBuf.writeBigInt64LE(BigInt(price));

  const confBuf = Buffer.alloc(8);
  confBuf.writeBigUInt64LE(BigInt(conf));

  const expoBuf = Buffer.alloc(4);
  expoBuf.writeInt32LE(exponent);

  const pubTimeBuf = Buffer.alloc(8);
  pubTimeBuf.writeBigInt64LE(BigInt(publishTime));

  const prevPubTimeBuf = Buffer.alloc(8);
  prevPubTimeBuf.writeBigInt64LE(
    BigInt(prevPublishTime !== null ? prevPublishTime : publishTime - 1)
  );

  const emaPriceBuf = Buffer.alloc(8);
  emaPriceBuf.writeBigInt64LE(BigInt(emaPrice !== null ? emaPrice : price));

  const emaConfBuf = Buffer.alloc(8);
  emaConfBuf.writeBigUInt64LE(BigInt(emaConf !== null ? emaConf : conf));

  const slotBuf = Buffer.alloc(8);
  slotBuf.writeBigUInt64LE(BigInt(postedSlot));

  return Buffer.concat([
    disc,
    writeAuthBuf,
    verifBuf,
    feedIdBuf,
    priceBuf,
    confBuf,
    expoBuf,
    pubTimeBuf,
    prevPubTimeBuf,
    emaPriceBuf,
    emaConfBuf,
    slotBuf,
  ]);
}

/**
 * Creates JSON format expected by solana-test-validator --account
 */
export function makeAccountFixtureJson({
  pubkey,
  buffer,
  owner = PYTH_RECEIVER_ID,
  lamports = 1_000_000_000,
}) {
  const address = typeof pubkey === 'string' ? pubkey : pubkey.toBase58();
  const ownerAddress = typeof owner === 'string' ? owner : owner.toBase58();
  return {
    pubkey: address,
    account: {
      lamports,
      data: [buffer.toString('base64'), 'base64'],
      owner: ownerAddress,
      executable: false,
      rentEpoch: 0,
      space: buffer.length,
    },
  };
}

export function generateAllFixtures(outDir = path.resolve('fixtures')) {
  fs.mkdirSync(outDir, { recursive: true });
  const now = Math.floor(Date.now() / 1000);

  const configs = [
    {
      name: 'valid',
      options: {
        publishTime: now,
        feedId: Array(32).fill(7),
        conf: 50n * 1_000_000n, // 50 bps < 200 bps
        verificationLevel: 'Full',
      },
      owner: PYTH_RECEIVER_ID,
    },
    {
      name: 'wrong-feed',
      options: {
        publishTime: now,
        feedId: Array(32).fill(99), // wrong feed_id
        conf: 50n * 1_000_000n,
        verificationLevel: 'Full',
      },
      owner: PYTH_RECEIVER_ID,
    },
    {
      name: 'stale',
      options: {
        publishTime: now - 120, // 120 seconds old (> 60s)
        feedId: Array(32).fill(7),
        conf: 50n * 1_000_000n,
        verificationLevel: 'Full',
      },
      owner: PYTH_RECEIVER_ID,
    },
    {
      name: 'wide-conf',
      options: {
        publishTime: now,
        feedId: Array(32).fill(7),
        conf: 500n * 1_000_000n, // 500 bps = 5.0% (> 2.0% threshold)
        verificationLevel: 'Full',
      },
      owner: PYTH_RECEIVER_ID,
    },
    {
      name: 'partial-verif',
      options: {
        publishTime: now,
        feedId: Array(32).fill(7),
        conf: 50n * 1_000_000n,
        verificationLevel: 'Partial', // VerificationLevel::Partial
      },
      owner: PYTH_RECEIVER_ID,
    },
    {
      name: 'prog-owned',
      options: {
        publishTime: now,
        feedId: Array(32).fill(7),
        conf: 50n * 1_000_000n,
        verificationLevel: 'Full',
      },
      owner: PROGRAM_ID, // Program-owned instead of Pyth receiver!
    },
  ];

  const results = {};
  for (const cfg of configs) {
    const kp = FIXTURE_KEYPAIRS[cfg.name];
    const buffer = buildPriceUpdateV2Buffer(cfg.options);
    const json = makeAccountFixtureJson({
      pubkey: kp.publicKey,
      buffer,
      owner: cfg.owner,
    });
    const filePath = path.join(outDir, `${cfg.name}-price.json`);
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
    results[cfg.name] = {
      address: kp.publicKey.toBase58(),
      filePath,
      owner: cfg.owner,
    };
  }

  // Also write an addresses.json mapping for convenience
  fs.writeFileSync(
    path.join(outDir, 'addresses.json'),
    JSON.stringify(FIXTURE_ADDRESSES, null, 2)
  );

  return results;
}

// When executed directly via node scripts/make-price-fixture.mjs
if (process.argv[1]?.endsWith('make-price-fixture.mjs')) {
  const results = generateAllFixtures();
  console.log('✅ Generated Pyth PriceUpdateV2 account fixtures in fixtures/:');
  for (const [name, info] of Object.entries(results)) {
    console.log(`  - ${name.padEnd(14)}: ${info.address} (owner: ${info.owner}) -> ${info.filePath}`);
  }
}
