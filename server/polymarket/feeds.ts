// Market-data adapters: Polymarket Gamma API for markets, Binance/Coinbase for spot prices,
// and a clearly-labelled simulated feed when the upstream APIs are unreachable.
import type { CryptoAsset, MarketQuote } from '../../src/polymarket/types';
import { detectAsset } from './parse';
import { mulberry32 } from './math';

export const ASSETS: CryptoAsset[] = ['BTC', 'ETH', 'SOL', 'XRP'];
const GAMMA = 'https://gamma-api.polymarket.com';

export interface Candle {
  openTime: number;
  open: number;
  close: number;
}

async function getJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${new URL(url).host}`);
  return (await res.json()) as T;
}

function parseMaybeJson<T>(v: unknown, fallback: T): T {
  if (Array.isArray(v)) return v as T;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

const num = (v: unknown, d = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : d;
};

/** Active binary crypto-price markets, most liquid first. Contract parsing happens in the engine. */
export async function fetchCryptoMarkets(limit = 500): Promise<Omit<MarketQuote, 'contract'>[]> {
  const raw = await getJson<any[]>(
    `${GAMMA}/markets?active=true&closed=false&archived=false&limit=${limit}&order=volume24hr&ascending=false`,
  );
  const out: Omit<MarketQuote, 'contract'>[] = [];
  for (const m of raw) {
    const question: string = m.question ?? '';
    if (!detectAsset(question)) continue;
    const outcomes = parseMaybeJson<string[]>(m.outcomes, []);
    const first = (outcomes[0] ?? '').toLowerCase();
    if (outcomes.length !== 2 || !['yes', 'up'].includes(first)) continue;
    const prices = parseMaybeJson<string[]>(m.outcomePrices, []).map((p) => num(p));
    const last = num(m.lastTradePrice, prices[0] ?? 0.5);
    const bid = num(m.bestBid, Math.max(0, (prices[0] ?? last) - 0.01));
    const ask = num(m.bestAsk, Math.min(1, (prices[0] ?? last) + 0.01));
    if (!(ask > 0) || ask < bid) continue;
    const eventSlug = m.events?.[0]?.slug;
    out.push({
      id: String(m.id),
      slug: m.slug ?? String(m.id),
      question,
      endDate: m.endDate ?? m.endDateIso ?? '',
      bid,
      ask,
      mid: (bid + ask) / 2,
      lastTrade: last,
      volume24h: num(m.volume24hr),
      liquidity: num(m.liquidityNum ?? m.liquidity),
      url: eventSlug ? `https://polymarket.com/event/${eventSlug}` : `https://polymarket.com/market/${m.slug}`,
    });
  }
  return out;
}

/** Up to `limit` hourly candles, oldest first. Binance first, Coinbase as fallback. */
export async function fetchHourlyCandles(asset: CryptoAsset, limit = 720): Promise<Candle[]> {
  try {
    const rows = await getJson<any[][]>(
      `https://api.binance.com/api/v3/klines?symbol=${asset}USDT&interval=1h&limit=${limit}`,
    );
    return rows.map((r) => ({ openTime: Number(r[0]), open: num(r[1]), close: num(r[4]) }));
  } catch {
    // Coinbase returns [time, low, high, open, close, volume], newest first, max 300 rows.
    const rows = await getJson<number[][]>(
      `https://api.exchange.coinbase.com/products/${asset}-USD/candles?granularity=3600`,
    );
    return rows
      .map((r) => ({ openTime: r[0] * 1000, open: r[3], close: r[4] }))
      .sort((a, b) => a.openTime - b.openTime);
  }
}

export async function fetchSpot(asset: CryptoAsset): Promise<number> {
  try {
    const r = await getJson<{ price: string }>(
      `https://api.binance.com/api/v3/ticker/price?symbol=${asset}USDT`,
      4000,
    );
    return num(r.price);
  } catch {
    const r = await getJson<{ data: { amount: string } }>(
      `https://api.coinbase.com/v2/prices/${asset}-USD/spot`,
      4000,
    );
    return num(r.data.amount);
  }
}

// ---------------------------------------------------------------------------
// Simulated feed — keeps the desk usable offline / in sandboxes. Always flagged in the UI.
// ---------------------------------------------------------------------------

const SIM_BASE: Record<CryptoAsset, { price: number; vol: number; name: string; step: number }> = {
  BTC: { price: 112_000, vol: 0.5, name: 'Bitcoin', step: 2000 },
  ETH: { price: 4_100, vol: 0.65, name: 'Ethereum', step: 100 },
  SOL: { price: 210, vol: 0.8, name: 'Solana', step: 10 },
  XRP: { price: 2.8, vol: 0.85, name: 'XRP', step: 0.1 },
};

export class SimulatedFeed {
  private candles = new Map<CryptoAsset, Candle[]>();
  private rand = mulberry32(42);

  constructor() {
    const now = Date.now() - (Date.now() % 3_600_000);
    for (const a of ASSETS) {
      const { price, vol } = SIM_BASE[a];
      const hv = vol / Math.sqrt(24 * 365);
      const rows: Candle[] = [];
      let p = price * 0.93;
      for (let h = 719; h >= 0; h--) {
        const open = p;
        p *= Math.exp(this.studentish() * hv + 0.00008);
        rows.push({ openTime: now - h * 3_600_000, open, close: p });
      }
      this.candles.set(a, rows);
    }
  }

  private gauss(): number {
    const u = Math.max(this.rand(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.rand());
  }

  /** Mildly fat-tailed shocks with unit variance. */
  private studentish(): number {
    const g = this.gauss();
    return this.rand() < 0.05 ? g * 2.5 : g * 0.92;
  }

  tick(): void {
    for (const a of ASSETS) {
      const rows = this.candles.get(a)!;
      const last = rows[rows.length - 1];
      const hv = SIM_BASE[a].vol / Math.sqrt(24 * 365);
      // 5-second step scaled from hourly vol.
      last.close *= Math.exp(this.studentish() * hv * Math.sqrt(5 / 3600));
      if (Date.now() - last.openTime >= 3_600_000) {
        rows.push({ openTime: last.openTime + 3_600_000, open: last.close, close: last.close });
        rows.shift();
      }
    }
  }

  getCandles(a: CryptoAsset): Candle[] {
    return this.candles.get(a)!.map((c) => ({ ...c }));
  }

  getSpot(a: CryptoAsset): number {
    const rows = this.candles.get(a)!;
    return rows[rows.length - 1].close;
  }

  /** A synthetic book of markets whose prices are deliberately a little noisy vs. fair value. */
  getMarkets(): Omit<MarketQuote, 'contract'>[] {
    const out: Omit<MarketQuote, 'contract'>[] = [];
    const now = new Date();
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
    const fmtPrice = (a: CryptoAsset, x: number) =>
      `$${x.toLocaleString('en-US', { maximumFractionDigits: a === 'XRP' ? 2 : 0 })}`;
    let n = 0;
    const noise = mulberry32(Math.floor(Date.now() / 60_000));
    for (const a of ASSETS) {
      const { name, step } = SIM_BASE[a];
      const spot = this.getSpot(a);
      const atm = Math.round(spot / step) * step;
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 16));
      const weekly = new Date(tomorrow.getTime() + 6 * 86_400_000);
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59));
      const specs: Array<[string, Date, number]> = [
        [`Will the price of ${name} be above ${fmtPrice(a, atm)} on ${fmt(tomorrow)}?`, tomorrow, 0.5],
        [`Will the price of ${name} be above ${fmtPrice(a, atm + 2 * step)} on ${fmt(weekly)}?`, weekly, 0.3],
        [`Will the price of ${name} be between ${fmtPrice(a, atm - step)} and ${fmtPrice(a, atm + step)} on ${fmt(tomorrow)}?`, tomorrow, 0.45],
        [`Will ${name} reach ${fmtPrice(a, atm + 5 * step)} in ${now.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })}?`, monthEnd, 0.2],
        [`Will ${name} dip to ${fmtPrice(a, atm - 5 * step)} in ${now.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })}?`, monthEnd, 0.22],
      ];
      for (const [question, end, base] of specs) {
        const mid = Math.min(0.97, Math.max(0.03, base + (noise() - 0.5) * 0.2));
        const half = 0.005 + noise() * 0.01;
        out.push({
          id: `sim-${n++}`,
          slug: `sim-${a.toLowerCase()}-${n}`,
          question,
          endDate: end.toISOString(),
          bid: +(mid - half).toFixed(3),
          ask: +(mid + half).toFixed(3),
          mid,
          lastTrade: mid,
          volume24h: Math.round(5_000 + noise() * 200_000),
          liquidity: Math.round(2_000 + noise() * 50_000),
          url: 'https://polymarket.com/crypto',
        });
      }
    }
    return out;
  }
}
