<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/cd010c37-0222-4247-aa76-cfbef0d8368b

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Polymarket Crypto Desk

The **Polymarket Crypto Desk** tab analyses Polymarket's crypto price markets (BTC, ETH, SOL, XRP) in real time and flags mispriced contracts.

**Data (refreshed every 5s, streamed to the browser over Server-Sent Events):**
- Markets and order books from the Polymarket Gamma API (re-polled every 30s)
- Spot prices and hourly candles from Binance, with Coinbase as a fallback
- If the live APIs can't be reached, a simulated feed takes over, clearly labelled in the UI

**Models:** each market question (above / below / between / reach / dip / up-or-down) is parsed into a contract and priced by:
1. Lognormal (Black-Scholes digital or barrier) using 30-day realised volatility
2. Vol-regime: EWMA short-term volatility decaying into long-run volatility over the horizon
3. Fat-tail Student-t(4)
4. Momentum drift (shrunk, and faded over long horizons)
5. Historical bootstrap Monte Carlo (filtered historical simulation with a barrier correction)
6. Optional AI analysts on demand: Claude (`ANTHROPIC_API_KEY`) and Gemini (`GEMINI_API_KEY`)

The models are averaged in log-odds space, then shrunk toward the market price (the "market prior weight" setting). Edge is measured against the executable ask after fees. Position sizes use fractional Kelly, scaled by how much the models agree and capped as a share of the bankroll.

**Paper trading only.** The desk never places real orders; paper positions are stored in your browser. Model edges are estimates and don't guarantee income. Check that Polymarket is available and legal where you live.

Run the model tests with `npm test`.
