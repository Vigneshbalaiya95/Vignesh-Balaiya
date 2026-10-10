// Shared types for the Polymarket crypto desk (used by both server and client).

export type CryptoAsset = 'BTC' | 'ETH' | 'SOL' | 'XRP';

/**
 * How a market resolves relative to the underlying spot price.
 * - above:      YES if spot at expiry is above `strike`
 * - below:      YES if spot at expiry is below `strike`
 * - between:    YES if `strike` <= spot at expiry < `upper`
 * - touch-up:   YES if spot trades at or above `strike` any time before expiry
 * - touch-down: YES if spot trades at or below `strike` any time before expiry
 * - updown:     YES ("Up") if spot at expiry is above the window's open (`strike`)
 */
export type MarketKind = 'above' | 'below' | 'between' | 'touch-up' | 'touch-down' | 'updown';

export interface ParsedContract {
  asset: CryptoAsset;
  kind: MarketKind;
  strike: number;
  upper?: number;
}

export interface MarketQuote {
  id: string;
  slug: string;
  question: string;
  endDate: string;
  /** Best bid / ask for the YES outcome, 0..1 */
  bid: number;
  ask: number;
  mid: number;
  lastTrade: number;
  volume24h: number;
  liquidity: number;
  url: string;
  contract: ParsedContract | null;
}

export interface SpotSnapshot {
  asset: CryptoAsset;
  price: number;
  change24h: number;
  /** Annualised volatility estimates */
  ewmaVol: number;
  realizedVol: number;
  /** Annualised drift estimate from recent returns (already shrunk) */
  drift: number;
  updatedAt: number;
}

export interface ModelEstimate {
  model: string;
  label: string;
  probability: number;
  weight: number;
  note?: string;
}

export type SignalSide = 'BUY_YES' | 'BUY_NO' | 'HOLD';

export interface MarketSignal {
  market: MarketQuote;
  spot: SpotSnapshot | null;
  hoursToExpiry: number;
  models: ModelEstimate[];
  fairProbability: number;
  /** Std-dev of model probabilities — higher means models disagree */
  disagreement: number;
  confidence: number;
  side: SignalSide;
  /** Expected profit per $1-payout share at the executable price, net of fees (0.05 = 5¢) */
  edge: number;
  entryPrice: number;
  /** Suggested stake as a fraction of bankroll (fractional Kelly, capped) */
  kellyFraction: number;
  reason: string;
}

export interface AiOpinion {
  provider: 'claude' | 'gemini';
  model: string;
  probability: number;
  confidence: number;
  rationale: string;
  createdAt: number;
}

export interface DeskSettings {
  minEdge: number;
  feeRate: number;
  kellyMultiplier: number;
  maxPositionFraction: number;
  marketWeight: number;
}

export interface DeskSnapshot {
  generatedAt: number;
  source: 'live' | 'simulated';
  sourceNote?: string;
  spots: SpotSnapshot[];
  signals: MarketSignal[];
  settings: DeskSettings;
  aiProviders: { claude: boolean; gemini: boolean };
}
