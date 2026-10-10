// Turns Polymarket question text into a machine-readable contract on a crypto spot price.
import type { CryptoAsset, ParsedContract } from '../../src/polymarket/types';

const ASSET_PATTERNS: Array<[CryptoAsset, RegExp]> = [
  ['BTC', /\b(bitcoin|btc)\b/i],
  ['ETH', /\b(ethereum|eth|ether)\b/i],
  ['SOL', /\b(solana|sol)\b/i],
  ['XRP', /\b(xrp|ripple)\b/i],
];

// Groups: optional "$", digits, optional magnitude suffix ("150k", "$1 million", "$2bn").
const NUMBER = String.raw`(\$)?\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s?(k|thousand|mn?|million|bn?|billion|trillion)\b)?`;

const MAGNITUDE: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mn: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
  trillion: 1e12,
};

function toNumber(digits: string, suffix?: string): number {
  const n = parseFloat(digits.replace(/,/g, ''));
  return suffix ? n * (MAGNITUDE[suffix.toLowerCase()] ?? 1) : n;
}

/**
 * Rejects numbers that cannot be a price level for the asset (years, percentages, TPS,
 * "$10 million" of ETF inflows...). Bare numbers without "$" must be close to spot.
 */
function plausibleStrike(strike: number, hasDollar: boolean, spotHint?: number): boolean {
  if (!(strike > 0)) return false;
  if (!spotHint) return true;
  const [lo, hi] = hasDollar ? [0.05, 20] : [1 / 3, 3];
  return strike >= spotHint * lo && strike <= spotHint * hi;
}

export function detectAsset(text: string): CryptoAsset | null {
  for (const [asset, re] of ASSET_PATTERNS) if (re.test(text)) return asset;
  return null;
}

export function parseQuestion(question: string, spotHint?: number): ParsedContract | null {
  const asset = detectAsset(question);
  if (!asset) return null;
  const q = question.replace(/\s+/g, ' ');

  if (/\bup or down\b/i.test(q)) {
    // Strike is the window open; filled in by the engine from candle history.
    return { asset, kind: 'updown', strike: spotHint ?? 0 };
  }

  const between = new RegExp(`between ${NUMBER} and ${NUMBER}`, 'i').exec(q);
  if (between) {
    const lo = toNumber(between[2], between[3]);
    const hi = toNumber(between[5], between[6]);
    if (
      hi > lo &&
      plausibleStrike(lo, Boolean(between[1]), spotHint) &&
      plausibleStrike(hi, Boolean(between[4]), spotHint)
    ) {
      return { asset, kind: 'between', strike: lo, upper: hi };
    }
  }

  const patterns: Array<[ParsedContract['kind'], RegExp]> = [
    ['touch-down', new RegExp(`\\b(dip|drop|fall|crash|sink)s?\\s+(?:to|below|under)\\s+${NUMBER}`, 'i')],
    ['touch-up', new RegExp(`\\b(reach|hit|touch|break|surpass|exceed)(?:es)?\\s+${NUMBER}`, 'i')],
    ['below', new RegExp(`\\b(below|under|less than|lower than)\\s+${NUMBER}`, 'i')],
    ['above', new RegExp(`\\b(above|over|greater than|higher than)\\s+${NUMBER}`, 'i')],
  ];
  for (const [kind, re] of patterns) {
    const m = re.exec(q);
    if (!m) continue;
    const strike = toNumber(m[3], m[4]);
    if (!plausibleStrike(strike, Boolean(m[2]), spotHint)) continue;
    return { asset, kind, strike };
  }
  return null;
}

/** Window length in minutes for "Up or Down" markets, inferred from slug or question. */
export function updownWindowMinutes(slug: string, question: string): number {
  const s = `${slug} ${question}`.toLowerCase();
  if (/\b15m\b|15-minute|15 min/.test(s)) return 15;
  if (/\b4h\b|4-hour/.test(s)) return 240;
  if (/\bdaily\b|-1d\b/.test(s)) return 1440;
  if (/\d{1,2}(:\d{2})?\s?(am|pm)/.test(s)) return 60;
  return 1440;
}
