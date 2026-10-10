// Numeric helpers for the pricing models.

export const HOURS_PER_YEAR = 24 * 365;

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, |err| < 7.5e-8). */
export function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

/** Student-t CDF with 4 degrees of freedom (closed form). */
export function studentT4Cdf(t: number): number {
  const u = 1 + (t * t) / 4;
  return 0.5 + (3 / 8) * (t / Math.sqrt(u)) * (1 - (t * t) / (12 * u));
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function clampProb(p: number): number {
  return clamp(Number.isFinite(p) ? p : 0.5, 0.001, 0.999);
}

export function logit(p: number): number {
  const q = clampProb(p);
  return Math.log(q / (1 - q));
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  }
  return out;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/** RiskMetrics-style EWMA volatility of per-period returns. */
export function ewmaStdev(returns: number[], lambda = 0.94): number {
  if (!returns.length) return 0;
  let variance = returns[0] ** 2;
  for (let i = 1; i < returns.length; i++) {
    variance = lambda * variance + (1 - lambda) * returns[i] ** 2;
  }
  return Math.sqrt(variance);
}

/** Deterministic PRNG so Monte Carlo output does not jitter between refreshes. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
