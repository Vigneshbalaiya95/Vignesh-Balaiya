// Real-time engine: polls market data, runs every model on every crypto market, and pushes
// ranked signals to subscribers (Server-Sent Events) on each tick.
import type {
  AiOpinion,
  CryptoAsset,
  DeskSettings,
  DeskSnapshot,
  MarketQuote,
  MarketSignal,
  ModelEstimate,
  SpotSnapshot,
} from '../../src/polymarket/types';
import { ASSETS, Candle, SimulatedFeed, fetchCryptoMarkets, fetchHourlyCandles, fetchSpot } from './feeds';
import { HOURS_PER_YEAR, clamp, ewmaStdev, logReturns, mean, stdev } from './math';
import { ensemble, runQuantModels } from './models';
import { parseQuestion, updownWindowMinutes } from './parse';
import { aiProviders, cachedOpinions } from './llm';

const SPOT_MS = 5_000;
const MARKETS_MS = 30_000;
const CANDLES_MS = 5 * 60_000;
const LIVE_RETRY_MS = 5 * 60_000;

export const DEFAULT_SETTINGS: DeskSettings = {
  minEdge: 0.03,
  feeRate: 0.03,
  kellyMultiplier: 0.25,
  maxPositionFraction: 0.05,
  marketWeight: 0.35,
};

type Listener = (snap: DeskSnapshot) => void;

export class PolymarketEngine {
  settings: DeskSettings = { ...DEFAULT_SETTINGS };
  private source: 'live' | 'simulated' = 'live';
  private sourceNote?: string;
  private sim: SimulatedFeed | null = null;
  private candles = new Map<CryptoAsset, Candle[]>();
  private spots = new Map<CryptoAsset, number>();
  private markets: Omit<MarketQuote, 'contract'>[] = [];
  private lastMarkets = 0;
  private lastCandles = 0;
  private lastLiveAttempt = 0;
  private listeners = new Set<Listener>();
  private snapshot: DeskSnapshot | null = null;
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private liveFailures = 0;

  constructor(private forceSimulated = process.env.POLYMARKET_SIMULATE === '1') {}

  start(): void {
    if (this.timer) return;
    const loop = async () => {
      if (this.busy) return;
      this.busy = true;
      try {
        await this.tick();
      } catch (err) {
        console.error('[polymarket] tick failed:', err);
      } finally {
        this.busy = false;
      }
    };
    void loop();
    this.timer = setInterval(loop, SPOT_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    if (this.snapshot) fn(this.snapshot);
    return () => this.listeners.delete(fn);
  }

  getSnapshot(): DeskSnapshot | null {
    return this.snapshot;
  }

  getSignal(marketId: string): MarketSignal | undefined {
    return this.snapshot?.signals.find((s) => s.market.id === marketId);
  }

  updateSettings(patch: Partial<DeskSettings>): DeskSettings {
    const s = { ...this.settings, ...patch };
    this.settings = {
      minEdge: clamp(Number(s.minEdge) || 0, 0, 0.5),
      feeRate: clamp(Number(s.feeRate) || 0, 0, 0.5),
      kellyMultiplier: clamp(Number(s.kellyMultiplier) || 0, 0, 1),
      maxPositionFraction: clamp(Number(s.maxPositionFraction) || 0, 0, 1),
      marketWeight: clamp(Number(s.marketWeight) || 0, 0, 1),
    };
    this.recompute();
    return this.settings;
  }

  /** Re-run models immediately (e.g. after new AI opinions or settings) and notify listeners. */
  recompute(): void {
    if (!this.markets.length) return;
    this.snapshot = this.buildSnapshot();
    for (const fn of this.listeners) fn(this.snapshot);
  }

  private useSimulated(reason: string): void {
    if (this.source !== 'simulated') console.warn(`[polymarket] switching to simulated feed: ${reason}`);
    this.source = 'simulated';
    this.sourceNote = reason;
    this.sim ??= new SimulatedFeed();
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    const tryLive =
      !this.forceSimulated && (this.source === 'live' || now - this.lastLiveAttempt > LIVE_RETRY_MS);

    if (tryLive) {
      this.lastLiveAttempt = now;
      try {
        await this.refreshLive(now, this.source === 'simulated');
        if (this.source === 'simulated') console.log('[polymarket] live feed restored');
        this.source = 'live';
        this.sourceNote = undefined;
        this.liveFailures = 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Ride out brief outages on the last good data; fall back only if they persist.
        if (this.source === 'simulated' || !this.markets.length || ++this.liveFailures >= 3) {
          this.useSimulated(`Live APIs unreachable (${msg})`);
        } else {
          console.warn(`[polymarket] live refresh failed (${this.liveFailures}/3): ${msg}`);
        }
      }
    } else if (this.forceSimulated) {
      this.useSimulated('POLYMARKET_SIMULATE=1');
    }

    if (this.source === 'simulated' && this.sim) {
      this.sim.tick();
      for (const a of ASSETS) {
        this.candles.set(a, this.sim.getCandles(a));
        this.spots.set(a, this.sim.getSpot(a));
      }
      if (now - this.lastMarkets > MARKETS_MS || !this.markets[0]?.id.startsWith('sim-')) {
        this.markets = this.sim.getMarkets();
        this.lastMarkets = now;
      }
    }
    this.recompute();
  }

  private async refreshLive(now: number, force: boolean): Promise<void> {
    const jobs: Promise<unknown>[] = [];
    if (force || now - this.lastMarkets > MARKETS_MS || !this.markets.length) {
      jobs.push(
        fetchCryptoMarkets().then((m) => {
          this.markets = m;
          this.lastMarkets = now;
        }),
      );
    }
    if (force || now - this.lastCandles > CANDLES_MS || this.candles.size < ASSETS.length) {
      jobs.push(
        Promise.all(ASSETS.map(async (a) => this.candles.set(a, await fetchHourlyCandles(a)))).then(() => {
          this.lastCandles = now;
        }),
      );
    }
    jobs.push(Promise.all(ASSETS.map(async (a) => this.spots.set(a, await fetchSpot(a)))));
    await Promise.all(jobs);
  }

  private spotSnapshot(asset: CryptoAsset): { snap: SpotSnapshot; returns: number[] } | null {
    const candles = this.candles.get(asset);
    const price = this.spots.get(asset);
    if (!candles?.length || !price) return null;
    const closes = candles.map((c) => c.close);
    closes[closes.length - 1] = price;
    const returns = logReturns(closes);
    const annualise = Math.sqrt(HOURS_PER_YEAR);
    const recent = returns.slice(-72);
    const dayAgo = closes[Math.max(0, closes.length - 25)];
    return {
      returns,
      snap: {
        asset,
        price,
        change24h: dayAgo ? price / dayAgo - 1 : 0,
        ewmaVol: Math.max(0.05, ewmaStdev(returns.slice(-240)) * annualise),
        realizedVol: Math.max(0.05, stdev(returns) * annualise),
        // Recent trend, shrunk hard: raw 3-day drift is mostly noise.
        drift: clamp(mean(recent) * HOURS_PER_YEAR * 0.25, -1.5, 1.5),
        updatedAt: Date.now(),
      },
    };
  }

  /** "Up or Down" strike = price at the window open, taken from the matching hourly candle. */
  private updownStrike(m: Omit<MarketQuote, 'contract'>, asset: CryptoAsset, spot: number): number | null {
    const end = Date.parse(m.endDate);
    const start = end - updownWindowMinutes(m.slug, m.question) * 60_000;
    if (start > Date.now()) return spot;
    const candle = this.candles.get(asset)?.find((c) => c.openTime === start);
    return candle ? candle.open : null;
  }

  private buildSnapshot(): DeskSnapshot {
    const now = Date.now();
    const spotData = new Map(
      ASSETS.map((a) => [a, this.spotSnapshot(a)] as const).filter(([, v]) => v !== null) as Array<
        [CryptoAsset, { snap: SpotSnapshot; returns: number[] }]
      >,
    );

    const signals: MarketSignal[] = [];
    for (const m of this.markets) {
      const hoursToExpiry = (Date.parse(m.endDate) - now) / 3_600_000;
      if (!(hoursToExpiry > 0)) continue;
      const parsedAsset = parseQuestion(m.question)?.asset;
      const data = parsedAsset ? spotData.get(parsedAsset) : undefined;
      let contract = parseQuestion(m.question, data?.snap.price);
      if (contract?.kind === 'updown' && data) {
        const strike = this.updownStrike(m, contract.asset, data.snap.price);
        contract = strike ? { ...contract, strike } : null;
      }
      const market: MarketQuote = { ...m, contract };
      if (!contract || !data) continue;

      const quant = runQuantModels({
        contract,
        spot: data.snap.price,
        hoursToExpiry,
        ewmaVol: data.snap.ewmaVol,
        realizedVol: data.snap.realizedVol,
        drift: data.snap.drift,
        hourlyReturns: data.returns.slice(-720),
        seedKey: `${m.id}:${Math.floor(now / 60_000)}`,
      });
      const ai = cachedOpinions(m.id).map(aiEstimate);
      signals.push(this.evaluate(market, data.snap, hoursToExpiry, [...quant, ...ai]));
    }

    signals.sort((a, b) => b.edge * b.confidence - a.edge * a.confidence);
    return {
      generatedAt: now,
      source: this.source,
      sourceNote: this.sourceNote,
      spots: [...spotData.values()].map((d) => d.snap),
      signals,
      settings: this.settings,
      aiProviders: aiProviders(),
    };
  }

  private evaluate(market: MarketQuote, spot: SpotSnapshot, hoursToExpiry: number, models: ModelEstimate[]): MarketSignal {
    const st = this.settings;
    const { probability: fair, disagreement } = ensemble(models, market.mid, st.marketWeight);
    // Fee per share modelled as feeRate * p * (1 - p), the shape Polymarket uses on fee-enabled markets.
    const fee = (p: number) => st.feeRate * p * (1 - p);
    const yesPrice = market.ask;
    const noPrice = 1 - market.bid;
    const edgeYes = fair - yesPrice - fee(yesPrice);
    const edgeNo = 1 - fair - noPrice - fee(noPrice);
    const buyYes = edgeYes >= edgeNo;
    const edge = buyYes ? edgeYes : edgeNo;
    const entryPrice = buyYes ? yesPrice : noPrice;

    const liquidityFactor = 0.5 + 0.5 * Math.min(1, market.liquidity / 20_000);
    const confidence = clamp((1 - disagreement / 0.2) * liquidityFactor, 0, 1);
    const spread = market.ask - market.bid;

    let side: MarketSignal['side'] = 'HOLD';
    let reason: string;
    if (spread > 0.08) reason = `Spread ${(spread * 100).toFixed(1)}¢ too wide`;
    else if (hoursToExpiry < 0.05) reason = 'Too close to expiry';
    else if (confidence < 0.25) reason = 'Models disagree too much';
    else if (edge < st.minEdge) reason = `Edge ${(edge * 100).toFixed(1)}¢ below ${(st.minEdge * 100).toFixed(1)}¢ threshold`;
    else {
      side = buyYes ? 'BUY_YES' : 'BUY_NO';
      reason = `Fair ${(fair * 100).toFixed(1)}% vs ${buyYes ? 'YES ask' : 'NO ask'} ${(entryPrice * 100).toFixed(1)}¢`;
    }

    const pWin = buyYes ? fair : 1 - fair;
    const cost = entryPrice + fee(entryPrice);
    const fullKelly = cost < 1 ? (pWin - cost) / (1 - cost) : 0;
    const kellyFraction =
      side === 'HOLD' ? 0 : clamp(fullKelly * st.kellyMultiplier * confidence, 0, st.maxPositionFraction);

    return {
      market,
      spot,
      hoursToExpiry,
      models,
      fairProbability: fair,
      disagreement,
      confidence,
      side,
      edge,
      entryPrice,
      kellyFraction,
      reason,
    };
  }
}

function aiEstimate(o: AiOpinion): ModelEstimate {
  return {
    model: `ai:${o.provider}`,
    label: o.provider === 'claude' ? 'Claude analyst' : 'Gemini analyst',
    probability: o.probability,
    weight: 0.5 + o.confidence,
    note: o.model,
  };
}
