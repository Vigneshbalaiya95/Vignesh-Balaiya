// Independent probability models for crypto price contracts, plus the ensemble that blends them.
import type { ModelEstimate, ParsedContract } from '../../src/polymarket/types';
import {
  HOURS_PER_YEAR,
  clampProb,
  hashString,
  logit,
  mean,
  mulberry32,
  normCdf,
  sigmoid,
  stdev,
  studentT4Cdf,
} from './math';

export interface ModelInputs {
  contract: ParsedContract;
  spot: number;
  hoursToExpiry: number;
  /** Annualised short-term (EWMA) and long-run (realised) vol */
  ewmaVol: number;
  realizedVol: number;
  /** Annualised drift, already shrunk towards zero */
  drift: number;
  /** Hourly log returns, oldest first */
  hourlyReturns: number[];
  seedKey: string;
}

type TailFn = (strike: number) => number;

/** P(S_T > K) under geometric Brownian motion. */
export function gbmAbove(S: number, K: number, sigma: number, mu: number, T: number): number {
  if (T <= 0 || sigma <= 0) return S > K ? 1 : 0;
  const d2 = (Math.log(S / K) + (mu - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  return normCdf(d2);
}

/** P(max_{t<=T} S_t >= K) for GBM (reflection principle with drift). */
export function gbmTouchUp(S: number, K: number, sigma: number, mu: number, T: number): number {
  if (S >= K) return 1;
  if (T <= 0 || sigma <= 0) return 0;
  return firstPassage(Math.log(K / S), mu - 0.5 * sigma * sigma, sigma, T);
}

/** P(min_{t<=T} S_t <= K) for GBM. */
export function gbmTouchDown(S: number, K: number, sigma: number, mu: number, T: number): number {
  if (S <= K) return 1;
  if (T <= 0 || sigma <= 0) return 0;
  return firstPassage(Math.log(S / K), -(mu - 0.5 * sigma * sigma), sigma, T);
}

/** Probability that Brownian motion with drift nu and vol sigma reaches level b > 0 by time T. */
function firstPassage(b: number, nu: number, sigma: number, T: number): number {
  const sT = sigma * Math.sqrt(T);
  const first = 1 - normCdf((b - nu * T) / sT);
  const n2 = normCdf((-b - nu * T) / sT);
  const second = n2 > 0 ? Math.exp((2 * nu * b) / (sigma * sigma) + Math.log(n2)) : 0;
  return Math.min(1, Math.max(0, first + second));
}

/** Combine a terminal-distribution tail function into the contract's YES probability. */
function terminalProbability(c: ParsedContract, above: TailFn): number {
  switch (c.kind) {
    case 'above':
    case 'updown':
      return above(c.strike);
    case 'below':
      return 1 - above(c.strike);
    case 'between':
      return Math.max(0, above(c.strike) - above(c.upper ?? Infinity));
    default:
      return NaN;
  }
}

/** Long-run vol for the horizon: short-term EWMA vol decays into realised vol (half-life 3 days). */
export function horizonVol(ewma: number, realized: number, hours: number): number {
  const kappa = Math.LN2 / 72;
  const x = kappa * Math.max(hours, 1e-6);
  const weight = (1 - Math.exp(-x)) / x;
  const variance = realized ** 2 + (ewma ** 2 - realized ** 2) * weight;
  return Math.sqrt(Math.max(variance, 1e-6));
}

function lognormalModel(i: ModelInputs, sigma: number, mu: number): number {
  const T = i.hoursToExpiry / HOURS_PER_YEAR;
  const c = i.contract;
  if (c.kind === 'touch-up') return gbmTouchUp(i.spot, c.strike, sigma, mu, T);
  if (c.kind === 'touch-down') return gbmTouchDown(i.spot, c.strike, sigma, mu, T);
  return terminalProbability(c, (K) => (K === Infinity ? 0 : gbmAbove(i.spot, K, sigma, mu, T)));
}

/** Student-t (nu=4) terminal returns scaled to the same variance — fatter tails than lognormal. */
function fatTailModel(i: ModelInputs, sigma: number): number {
  const T = i.hoursToExpiry / HOURS_PER_YEAR;
  const sT = sigma * Math.sqrt(Math.max(T, 1e-9));
  // A t(4) variable has variance 2, so scale z by sqrt(2) to match sigma.
  const above = (K: number) => {
    if (K === Infinity) return 0;
    const z = (Math.log(K / i.spot) + 0.5 * sigma * sigma * T) / sT;
    return 1 - studentT4Cdf(z * Math.SQRT2);
  };
  const c = i.contract;
  if (c.kind === 'touch-up') return i.spot >= c.strike ? 1 : Math.min(1, 2 * above(c.strike));
  if (c.kind === 'touch-down') return i.spot <= c.strike ? 1 : Math.min(1, 2 * (1 - above(c.strike)));
  return terminalProbability(c, above);
}

/**
 * Filtered historical simulation: resample standardised historical hourly returns,
 * rescale to the current vol, and track both the terminal price and the running extremes.
 */
function bootstrapModel(i: ModelInputs, sigma: number, paths = 1500): number {
  const r = i.hourlyReturns;
  if (r.length < 48) return NaN;
  const m = mean(r);
  const sd = stdev(r) || 1;
  const z = r.map((x) => (x - m) / sd);
  const hours = Math.max(i.hoursToExpiry, 1 / 60);
  const steps = Math.min(200, Math.max(1, Math.ceil(hours)));
  const dtHours = hours / steps;
  const stepVol = (sigma / Math.sqrt(HOURS_PER_YEAR)) * Math.sqrt(dtHours);
  const drift = -0.5 * stepVol * stepVol;
  // Broadie–Glasserman continuity correction for discretely monitored barriers.
  const shift = Math.exp(0.5826 * stepVol);
  const c = i.contract;
  const upBarrier = c.kind === 'touch-up' ? Math.log(c.strike / shift / i.spot) : Infinity;
  const downBarrier = c.kind === 'touch-down' ? Math.log((c.strike * shift) / i.spot) : -Infinity;
  const rand = mulberry32(hashString(i.seedKey));
  let hits = 0;
  for (let p = 0; p < paths; p++) {
    let x = 0;
    let touched = false;
    for (let s = 0; s < steps; s++) {
      x += drift + z[Math.floor(rand() * z.length)] * stepVol;
      if (x >= upBarrier || x <= downBarrier) {
        touched = true;
        break;
      }
    }
    if (c.kind === 'touch-up' || c.kind === 'touch-down') {
      if (touched) hits++;
      continue;
    }
    const ST = i.spot * Math.exp(x);
    const yes =
      c.kind === 'below'
        ? ST < c.strike
        : c.kind === 'between'
          ? ST >= c.strike && ST < (c.upper ?? Infinity)
          : ST > c.strike;
    if (yes) hits++;
  }
  return (hits + 0.5) / (paths + 1);
}

export interface ModelWeights {
  lognormal: number;
  volRegime: number;
  fatTail: number;
  momentum: number;
  bootstrap: number;
}

export const DEFAULT_WEIGHTS: ModelWeights = {
  lognormal: 1,
  volRegime: 1,
  fatTail: 1,
  momentum: 0.75,
  bootstrap: 1.25,
};

export function runQuantModels(i: ModelInputs, w: ModelWeights = DEFAULT_WEIGHTS): ModelEstimate[] {
  const blended = horizonVol(i.ewmaVol, i.realizedVol, i.hoursToExpiry);
  // Momentum fades over long horizons — trends rarely persist for weeks.
  const momentumDrift = i.drift * Math.exp(-i.hoursToExpiry / (24 * 14));
  const out: ModelEstimate[] = [
    {
      model: 'lognormal',
      label: 'Lognormal (realised vol)',
      probability: lognormalModel(i, i.realizedVol, 0),
      weight: w.lognormal,
      note: `σ=${(i.realizedVol * 100).toFixed(0)}%`,
    },
    {
      model: 'vol-regime',
      label: 'Vol-regime (EWMA term structure)',
      probability: lognormalModel(i, blended, 0),
      weight: w.volRegime,
      note: `σ(T)=${(blended * 100).toFixed(0)}%`,
    },
    {
      model: 'fat-tail',
      label: 'Fat-tail Student-t(4)',
      probability: fatTailModel(i, blended),
      weight: w.fatTail,
    },
    {
      model: 'momentum',
      label: 'Momentum drift',
      probability: lognormalModel(i, blended, momentumDrift),
      weight: w.momentum,
      note: `μ=${(momentumDrift * 100).toFixed(0)}%/yr`,
    },
    {
      model: 'bootstrap',
      label: 'Historical bootstrap MC',
      probability: bootstrapModel(i, blended),
      weight: w.bootstrap,
      note: '1.5k paths',
    },
  ];
  return out
    .filter((e) => Number.isFinite(e.probability))
    .map((e) => ({ ...e, probability: clampProb(e.probability) }));
}

export interface EnsembleResult {
  probability: number;
  disagreement: number;
}

/**
 * Weighted log-odds average of the model probabilities, then shrunk towards the market price
 * by `marketWeight` (the crowd is a strong prior; pure models overstate edges).
 */
export function ensemble(models: ModelEstimate[], marketMid: number, marketWeight: number): EnsembleResult {
  const usable = models.filter((m) => m.weight > 0);
  const totalW = usable.reduce((a, m) => a + m.weight, 0);
  if (!usable.length || totalW <= 0) return { probability: clampProb(marketMid), disagreement: 0 };
  const modelLogit = usable.reduce((a, m) => a + m.weight * logit(m.probability), 0) / totalW;
  const meanP = usable.reduce((a, m) => a + m.weight * m.probability, 0) / totalW;
  const variance = usable.reduce((a, m) => a + m.weight * (m.probability - meanP) ** 2, 0) / totalW;
  const blended = (1 - marketWeight) * modelLogit + marketWeight * logit(marketMid);
  return { probability: clampProb(sigmoid(blended)), disagreement: Math.sqrt(variance) };
}
