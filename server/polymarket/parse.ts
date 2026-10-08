// Turns Polymarket question text into a machine-readable contract on a crypto spot price.
import type { CryptoAsset, ParsedContract } from '../../src/polymarket/types';

const ASSET_PATTERNS: Array<[CryptoAsset, RegExp]> = [
  ['BTC', /\b(bitcoin|btc)\b/i],
  ['ETH', /\b(ethereum|eth|ether)\b/i],
  ['SOL', /\b(solana|sol)\b/i],
  ['XRP', /\b(xrp|ripple)\b/i],
];

const NUMBER = String.raw`\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?([kKmM]\b)?`;

function toNumber(digits: string, suffix?: string): number {
  let n = parseFloat(digits.replace(/,/g, ''));
  if (suffix && /k/i.test(suffix)) n *= 1_000;
  if (suffix && /m/i.test(suffix)) n *= 1_000_000;
  return n;
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
    const lo = toNumber(between[1], between[2]);
    const hi = toNumber(between[3], between[4]);
    if (lo > 0 && hi > lo) return { asset, kind: 'between', strike: lo, upper: hi };
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
    const strike = toNumber(m[2], m[3]);
    if (!(strike > 0)) continue;
    // Reject obviously wrong matches such as years or percentages.
    if (spotHint && (strike < spotHint * 0.05 || strike > spotHint * 20)) continue;
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
