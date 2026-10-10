import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestion } from './parse';
import { ensemble, gbmAbove, gbmTouchUp, gbmTouchDown, runQuantModels } from './models';
import { normCdf, studentT4Cdf, mulberry32 } from './math';
import type { ModelEstimate } from '../../src/polymarket/types';

test('parses common Polymarket crypto question formats', () => {
  assert.deepEqual(parseQuestion('Will the price of Bitcoin be above $110,000 on October 10?'), {
    asset: 'BTC',
    kind: 'above',
    strike: 110_000,
  });
  assert.deepEqual(parseQuestion('Will Bitcoin reach $150k by December 31, 2026?'), {
    asset: 'BTC',
    kind: 'touch-up',
    strike: 150_000,
  });
  assert.deepEqual(parseQuestion('Will Ethereum dip to $3,000 in October?'), {
    asset: 'ETH',
    kind: 'touch-down',
    strike: 3_000,
  });
  assert.deepEqual(parseQuestion('Will the price of Solana be between $200 and $210 on October 9?'), {
    asset: 'SOL',
    kind: 'between',
    strike: 200,
    upper: 210,
  });
  assert.equal(parseQuestion('Bitcoin Up or Down - October 8, 3PM ET')?.kind, 'updown');
  assert.equal(parseQuestion('Will XRP be below $2.50 on Friday?')?.strike, 2.5);
  assert.equal(parseQuestion('Will the Fed cut rates in December?'), null);
  // A year must not be read as a strike when a spot hint is available.
  assert.equal(parseQuestion('Will Bitcoin hit 2027 highs?', 110_000), null);
});

test('ignores numbers that are not price levels for the asset', () => {
  assert.equal(parseQuestion('Will XRP ETF inflows exceed $10 million in October?', 2.2), null);
  assert.equal(parseQuestion('Will Solana TPS exceed 1,000 in October?', 210), null);
  assert.equal(parseQuestion('Will Bitcoin dominance be above 60% on Friday?', 110_000), null);
  assert.equal(
    parseQuestion('Will Bitcoin ETF inflows be between $1 billion and $2 billion this week?', 110_000),
    null,
  );
  // Magnitude words still work for genuine price targets, and bare numbers near spot are accepted.
  assert.deepEqual(parseQuestion('Will Bitcoin reach $1 million by 2030?', 110_000), {
    asset: 'BTC',
    kind: 'touch-up',
    strike: 1_000_000,
  });
  assert.equal(parseQuestion('Will the price of Bitcoin be above 110,000 on October 10?', 108_000)?.strike, 110_000);
  assert.equal(parseQuestion('Will XRP be below $2.50 by Friday?', 2.2)?.strike, 2.5);
});

test('math primitives', () => {
  assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(normCdf(1.96) - 0.975) < 1e-3);
  assert.ok(Math.abs(studentT4Cdf(0) - 0.5) < 1e-12);
  assert.ok(Math.abs(studentT4Cdf(2.776) - 0.975) < 1e-3);
});

test('GBM closed forms behave sensibly', () => {
  const T = 30 / 365;
  assert.ok(Math.abs(gbmAbove(100, 100, 0.6, 0.5 * 0.36, T) - 0.5) < 1e-6);
  const touch = gbmTouchUp(100, 110, 0.6, 0, T);
  const terminal = gbmAbove(100, 110, 0.6, 0, T);
  // Touching is always at least as likely as finishing above, and roughly twice as likely (reflection principle).
  assert.ok(touch > terminal && touch < 2.2 * terminal);
  assert.equal(gbmTouchUp(120, 110, 0.6, 0, T), 1);
  assert.equal(gbmTouchDown(100, 105, 0.6, 0, T), 1);
  assert.ok(gbmTouchDown(100, 90, 0.6, 0, T) > gbmTouchDown(100, 80, 0.6, 0, T));
});

test('quant models agree roughly on an at-the-money daily contract', () => {
  const rand = mulberry32(7);
  const hourly = Array.from({ length: 720 }, () => (rand() - 0.5) * 0.02);
  const models = runQuantModels({
    contract: { asset: 'BTC', kind: 'above', strike: 100_000 },
    spot: 100_000,
    hoursToExpiry: 24,
    ewmaVol: 0.5,
    realizedVol: 0.5,
    drift: 0,
    hourlyReturns: hourly,
    seedKey: 'test',
  });
  assert.equal(models.length, 5);
  for (const m of models) assert.ok(Math.abs(m.probability - 0.5) < 0.06, `${m.model}=${m.probability}`);

  const touch = runQuantModels({
    contract: { asset: 'BTC', kind: 'touch-up', strike: 110_000 },
    spot: 100_000,
    hoursToExpiry: 24 * 30,
    ewmaVol: 0.5,
    realizedVol: 0.5,
    drift: 0,
    hourlyReturns: hourly,
    seedKey: 'test',
  });
  const closed = touch.find((m) => m.model === 'lognormal')!.probability;
  const mc = touch.find((m) => m.model === 'bootstrap')!.probability;
  assert.ok(Math.abs(closed - mc) < 0.08, `closed=${closed} mc=${mc}`);
});

test('ensemble shrinks towards the market and reports disagreement', () => {
  const models: ModelEstimate[] = [
    { model: 'a', label: 'a', probability: 0.7, weight: 1 },
    { model: 'b', label: 'b', probability: 0.6, weight: 1 },
  ];
  const pure = ensemble(models, 0.5, 0);
  const shrunk = ensemble(models, 0.5, 0.5);
  assert.ok(pure.probability > 0.6 && pure.probability < 0.7);
  assert.ok(shrunk.probability < pure.probability && shrunk.probability > 0.5);
  assert.ok(Math.abs(pure.disagreement - 0.05) < 1e-9);
});
