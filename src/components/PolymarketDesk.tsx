import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Radio,
  Trash2,
  Wallet,
} from 'lucide-react';
import type {
  AiOpinion,
  CryptoAsset,
  DeskSettings,
  DeskSnapshot,
  MarketSignal,
  SignalSide,
} from '../polymarket/types';

interface PaperPosition {
  id: string;
  marketId: string;
  question: string;
  side: Exclude<SignalSide, 'HOLD'>;
  shares: number;
  entry: number;
  openedAt: number;
  lastMark: number;
}

const STORAGE_KEY = 'polymarket-desk-paper-v1';

function loadPaper(): { bankroll: number; positions: PaperPosition[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore unavailable storage
  }
  return { bankroll: 1000, positions: [] };
}

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const cents = (x: number) => `${(x * 100).toFixed(1)}¢`;
const usd = (x: number) =>
  x.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: x >= 100 ? 0 : 2 });

const KIND_LABEL: Record<string, string> = {
  above: 'Close above',
  below: 'Close below',
  between: 'Close in range',
  'touch-up': 'Touch ↑',
  'touch-down': 'Touch ↓',
  updown: 'Up / Down',
};

function formatExpiry(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Price at which a position could be exited right now. */
function markFor(side: PaperPosition['side'], s: MarketSignal): number {
  return side === 'BUY_YES' ? s.market.bid : 1 - s.market.ask;
}

export default function PolymarketDesk() {
  const [snap, setSnap] = useState<DeskSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [assetFilter, setAssetFilter] = useState<CryptoAsset | 'ALL'>('ALL');
  const [onlyActionable, setOnlyActionable] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [opinions, setOpinions] = useState<Record<string, AiOpinion[]>>({});
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [paper, setPaper] = useState(loadPaper);

  // Real-time feed via Server-Sent Events, with polling fallback.
  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (poll) return;
      const load = () =>
        fetch('/api/polymarket/snapshot')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d && setSnap(d))
          .catch(() => undefined);
      load();
      poll = setInterval(load, 5000);
    };
    try {
      es = new EventSource('/api/polymarket/stream');
      es.onopen = () => setConnected(true);
      es.onmessage = (e) => {
        setConnected(true);
        setSnap(JSON.parse(e.data));
      };
      es.onerror = () => {
        setConnected(false);
        if (es?.readyState === EventSource.CLOSED) startPolling();
      };
    } catch {
      startPolling();
    }
    return () => {
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(paper));
    } catch {
      // ignore unavailable storage
    }
  }, [paper]);

  // Keep the last known mark on each paper position so P&L survives a market leaving the feed.
  useEffect(() => {
    if (!snap) return;
    const byId = new Map<string, MarketSignal>(snap.signals.map((s) => [s.market.id, s]));
    setPaper((p) => {
      let changed = false;
      const positions = p.positions.map((pos) => {
        const s = byId.get(pos.marketId);
        if (!s) return pos;
        const mark = markFor(pos.side, s);
        if (mark === pos.lastMark) return pos;
        changed = true;
        return { ...pos, lastMark: mark };
      });
      return changed ? { ...p, positions } : p;
    });
  }, [snap]);

  const signals = useMemo(() => {
    if (!snap) return [];
    return snap.signals.filter(
      (s) =>
        (assetFilter === 'ALL' || s.market.contract?.asset === assetFilter) &&
        (!onlyActionable || s.side !== 'HOLD'),
    );
  }, [snap, assetFilter, onlyActionable]);

  const actionableCount = snap?.signals.filter((s) => s.side !== 'HOLD').length ?? 0;
  const invested = paper.positions.reduce((a, p) => a + p.shares * p.entry, 0);
  const markValue = paper.positions.reduce((a, p) => a + p.shares * p.lastMark, 0);
  const cash = paper.bankroll - invested;

  const updateSetting = async (key: keyof DeskSettings, value: number) => {
    const res = await fetch('/api/polymarket/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    if (res.ok && snap) {
      const { settings } = await res.json();
      setSnap({ ...snap, settings });
    }
  };

  const askAi = async (marketId: string) => {
    setAiBusy(marketId);
    setAiError(null);
    try {
      const res = await fetch(`/api/polymarket/analyze/${encodeURIComponent(marketId)}`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'AI analysis failed');
      setOpinions((o) => ({ ...o, [marketId]: body.opinions }));
      if (body.errors?.length) setAiError(body.errors.join(' · '));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiBusy(null);
    }
  };

  const paperBuy = (s: MarketSignal) => {
    if (s.side === 'HOLD') return;
    const stake = Math.min(cash, Math.max(1, s.kellyFraction * paper.bankroll));
    if (stake <= 0) return;
    const pos: PaperPosition = {
      id: `${s.market.id}-${Date.now()}`,
      marketId: s.market.id,
      question: s.market.question,
      side: s.side,
      shares: stake / s.entryPrice,
      entry: s.entryPrice,
      openedAt: Date.now(),
      lastMark: markFor(s.side, s),
    };
    setPaper((p) => ({ ...p, positions: [pos, ...p.positions] }));
  };

  const closePosition = (id: string) => {
    setPaper((p) => {
      const pos = p.positions.find((x) => x.id === id);
      if (!pos) return p;
      const pnl = pos.shares * (pos.lastMark - pos.entry);
      return { bankroll: p.bankroll + pnl, positions: p.positions.filter((x) => x.id !== id) };
    });
  };

  const settings = snap?.settings;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold font-mono">
            <Radio className={`w-3 h-3 ${connected ? 'text-[#4ADE80] animate-pulse' : 'text-white/30'}`} />
            <span className={connected ? 'text-[#4ADE80]' : 'text-white/40'}>
              {connected ? 'Streaming' : 'Connecting…'}
            </span>
            {snap && (
              <span
                className={`px-2 py-0.5 rounded-full border ${
                  snap.source === 'live'
                    ? 'border-[#4ADE80]/30 text-[#4ADE80]'
                    : 'border-amber-400/40 text-amber-300'
                }`}
              >
                {snap.source === 'live' ? 'Live Polymarket data' : 'Simulated data'}
              </span>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-serif italic text-white mt-2">Polymarket Crypto Desk</h2>
          <p className="text-xs text-white/40 max-w-2xl mt-1 leading-relaxed">
            Five quant models (lognormal, EWMA vol-regime, fat-tail Student-t, momentum drift, historical bootstrap
            Monte Carlo) plus optional Claude and Gemini analysts are blended into a fair probability for every crypto
            price market, then compared with the live order book after fees.
          </p>
        </div>
        {snap && (
          <div className="text-[10px] font-mono text-white/40 text-left md:text-right">
            <div>Updated {new Date(snap.generatedAt).toLocaleTimeString()}</div>
            <div>
              {snap.signals.length} markets · <span className="text-[#4ADE80]">{actionableCount} actionable</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 items-start p-3 rounded-sm border border-amber-400/20 bg-amber-400/5 text-[11px] text-amber-100/80 leading-relaxed">
        <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
        <div>
          Research and paper trading only — this desk never places real orders. Model edges are estimates, not guaranteed
          income: markets can be efficient, resolution rules can differ from the model, and you can lose your entire stake.
          Check that Polymarket is legal where you live before trading.
          {snap?.source === 'simulated' && snap.sourceNote && (
            <span className="block text-amber-300 mt-1">Showing simulated markets: {snap.sourceNote}</span>
          )}
        </div>
      </div>

      {/* Spot tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(snap?.spots ?? []).map((s) => (
          <div key={s.asset} className="bg-[#0D0D0D] border border-white/5 rounded-sm p-4">
            <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-white/40">
              <span>{s.asset}</span>
              <span className={s.change24h >= 0 ? 'text-[#4ADE80]' : 'text-rose-400'}>
                {s.change24h >= 0 ? '+' : ''}
                {pct(s.change24h, 2)}
              </span>
            </div>
            <div className="text-xl text-white font-semibold mt-1 tabular-nums">
              ${s.price.toLocaleString('en-US', { maximumFractionDigits: s.price < 10 ? 4 : 2 })}
            </div>
            <div className="text-[10px] font-mono text-white/35 mt-1">
              σ EWMA {pct(s.ewmaVol, 0)} · 30d {pct(s.realizedVol, 0)}
            </div>
          </div>
        ))}
        {!snap && <div className="col-span-full text-xs text-white/40 font-mono">Warming up models…</div>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Signals */}
        <div className="bg-[#0D0D0D] border border-white/5 rounded-sm">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b border-white/5">
            {(['ALL', 'BTC', 'ETH', 'SOL', 'XRP'] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAssetFilter(a)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono cursor-pointer ${
                  assetFilter === a ? 'bg-[#4ADE80] text-black font-bold' : 'text-white/50 hover:bg-white/5'
                }`}
              >
                {a}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-[11px] text-white/50 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyActionable}
                onChange={(e) => setOnlyActionable(e.target.checked)}
                className="accent-[#4ADE80]"
              />
              Actionable only
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-white/30 font-mono text-left">
                  <th className="p-3 font-normal">Market</th>
                  <th className="p-3 font-normal text-right">Bid / Ask</th>
                  <th className="p-3 font-normal text-right">Fair</th>
                  <th className="p-3 font-normal text-right">Edge</th>
                  <th className="p-3 font-normal text-right">Conf.</th>
                  <th className="p-3 font-normal">Signal</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => {
                  const open = expanded === s.market.id;
                  const ops = opinions[s.market.id];
                  return (
                    <React.Fragment key={s.market.id}>
                      <tr
                        onClick={() => setExpanded(open ? null : s.market.id)}
                        className="border-t border-white/5 hover:bg-white/[0.03] cursor-pointer"
                      >
                        <td className="p-3 max-w-[340px]">
                          <div className="flex gap-2 items-start">
                            {open ? (
                              <ChevronDown className="w-3.5 h-3.5 text-white/40 mt-0.5 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-white/40 mt-0.5 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="text-white/85 leading-snug">{s.market.question}</div>
                              <div className="text-[10px] font-mono text-white/35 mt-0.5">
                                {s.market.contract?.asset} · {KIND_LABEL[s.market.contract?.kind ?? ''] ?? '—'} ·{' '}
                                {formatExpiry(s.hoursToExpiry)} · vol ${Math.round(s.market.volume24h).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-white/60 whitespace-nowrap">
                          {cents(s.market.bid)} / {cents(s.market.ask)}
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-white">{pct(s.fairProbability)}</td>
                        <td
                          className={`p-3 text-right font-mono tabular-nums ${
                            s.edge > 0 ? 'text-[#4ADE80]' : 'text-white/35'
                          }`}
                        >
                          {s.edge > 0 ? '+' : ''}
                          {cents(s.edge)}
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-white/60">{pct(s.confidence, 0)}</td>
                        <td className="p-3 whitespace-nowrap">
                          {s.side === 'HOLD' ? (
                            <span className="text-[10px] font-mono text-white/30">HOLD</span>
                          ) : (
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                s.side === 'BUY_YES' ? 'bg-[#4ADE80]/15 text-[#4ADE80]' : 'bg-rose-400/15 text-rose-300'
                              }`}
                            >
                              {s.side === 'BUY_YES' ? 'BUY YES' : 'BUY NO'} · {pct(s.kellyFraction)}
                            </span>
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-black/40">
                          <td colSpan={6} className="p-4">
                            <div className="grid md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <div className="text-[10px] uppercase tracking-widest text-white/35 font-mono">
                                  Model breakdown
                                </div>
                                {s.models.map((m) => (
                                  <div key={m.model} className="flex items-center gap-2 text-[11px]">
                                    <span className="w-44 text-white/60 truncate" title={m.note}>
                                      {m.label}
                                    </span>
                                    <div className="flex-1 h-1.5 bg-white/5 rounded relative">
                                      <div
                                        className={`absolute inset-y-0 left-0 rounded ${
                                          m.model.startsWith('ai:') ? 'bg-sky-400' : 'bg-[#4ADE80]/70'
                                        }`}
                                        style={{ width: `${m.probability * 100}%` }}
                                      />
                                      <div
                                        className="absolute -top-1 -bottom-1 w-px bg-amber-300"
                                        style={{ left: `${s.market.mid * 100}%` }}
                                        title="Market mid"
                                      />
                                    </div>
                                    <span className="w-12 text-right font-mono tabular-nums text-white/80">
                                      {pct(m.probability)}
                                    </span>
                                  </div>
                                ))}
                                <div className="text-[10px] text-white/35 font-mono pt-1">
                                  Amber tick = market mid {pct(s.market.mid)} · model spread ±{pct(s.disagreement)} ·{' '}
                                  {s.reason}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => askAi(s.market.id)}
                                    disabled={aiBusy === s.market.id || !(snap?.aiProviders.claude || snap?.aiProviders.gemini)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-500/15 text-sky-300 text-[11px] font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                                    title={
                                      snap?.aiProviders.claude || snap?.aiProviders.gemini
                                        ? 'Ask the AI analysts for an independent estimate'
                                        : 'Set ANTHROPIC_API_KEY or GEMINI_API_KEY on the server'
                                    }
                                  >
                                    <Bot className="w-3.5 h-3.5" />
                                    {aiBusy === s.market.id ? 'Analysing…' : 'Ask AI analysts'}
                                  </button>
                                  <button
                                    onClick={() => paperBuy(s)}
                                    disabled={s.side === 'HOLD'}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#4ADE80]/15 text-[#4ADE80] text-[11px] font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                                  >
                                    <Wallet className="w-3.5 h-3.5" />
                                    Paper trade {usd(Math.max(1, s.kellyFraction * paper.bankroll))}
                                  </button>
                                  <a
                                    href={s.market.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/5 text-white/60 text-[11px] hover:text-white"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" /> Polymarket
                                  </a>
                                </div>
                                {aiError && expanded === s.market.id && (
                                  <div className="text-[11px] text-rose-300">{aiError}</div>
                                )}
                                {ops?.map((o) => (
                                  <div key={o.provider} className="text-[11px] border border-white/5 rounded p-2.5">
                                    <div className="flex justify-between font-mono text-[10px] text-sky-300">
                                      <span>{o.model}</span>
                                      <span>
                                        {pct(o.probability)} · conf {pct(o.confidence, 0)}
                                      </span>
                                    </div>
                                    <p className="text-white/60 mt-1 leading-relaxed">{o.rationale}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {snap && !signals.length && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-white/35 text-xs">
                      No markets match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side panel: settings + paper portfolio */}
        <div className="space-y-6">
          <div className="bg-[#0D0D0D] border border-white/5 rounded-sm p-4 space-y-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 font-mono">
              <Activity className="w-3.5 h-3.5" /> Strategy settings
            </div>
            {settings &&
              (
                [
                  ['minEdge', 'Min edge (¢)', 100, 0.5],
                  ['feeRate', 'Fee rate (%)', 100, 0.5],
                  ['marketWeight', 'Market prior weight (%)', 100, 5],
                  ['kellyMultiplier', 'Kelly multiplier (%)', 100, 5],
                  ['maxPositionFraction', 'Max stake / bankroll (%)', 100, 0.5],
                ] as Array<[keyof DeskSettings, string, number, number]>
              ).map(([key, label, scale, step]) => (
                <label key={key} className="flex items-center justify-between gap-3 text-[11px] text-white/60">
                  <span>{label}</span>
                  <input
                    type="number"
                    step={step}
                    min={0}
                    defaultValue={+(settings[key] * scale).toFixed(2)}
                    onBlur={(e) => updateSetting(key, Number(e.target.value) / scale)}
                    className="w-20 bg-black border border-white/10 rounded px-2 py-1 text-right font-mono text-white"
                  />
                </label>
              ))}
            <div className="text-[10px] text-white/30 font-mono pt-1">
              AI analysts: Claude {snap?.aiProviders.claude ? 'on' : 'off'} · Gemini{' '}
              {snap?.aiProviders.gemini ? 'on' : 'off'}
            </div>
          </div>

          <div className="bg-[#0D0D0D] border border-white/5 rounded-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 font-mono">
                <Wallet className="w-3.5 h-3.5" /> Paper portfolio
              </div>
              <button
                onClick={() => setPaper({ bankroll: 1000, positions: [] })}
                className="text-[10px] text-white/30 hover:text-rose-300 cursor-pointer"
              >
                Reset
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[9px] uppercase text-white/30 font-mono">Equity</div>
                <div className="text-sm text-white font-semibold tabular-nums">{usd(cash + markValue)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-white/30 font-mono">Cash</div>
                <div className="text-sm text-white/70 tabular-nums">{usd(cash)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-white/30 font-mono">Open P&L</div>
                <div
                  className={`text-sm tabular-nums ${markValue - invested >= 0 ? 'text-[#4ADE80]' : 'text-rose-400'}`}
                >
                  {usd(markValue - invested)}
                </div>
              </div>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {paper.positions.map((p) => {
                const pnl = p.shares * (p.lastMark - p.entry);
                return (
                  <div key={p.id} className="border border-white/5 rounded p-2 text-[11px]">
                    <div className="text-white/70 leading-snug">{p.question}</div>
                    <div className="flex justify-between items-center mt-1 font-mono text-[10px]">
                      <span className={p.side === 'BUY_YES' ? 'text-[#4ADE80]' : 'text-rose-300'}>
                        {p.side === 'BUY_YES' ? 'YES' : 'NO'} {p.shares.toFixed(1)} @ {cents(p.entry)}
                      </span>
                      <span className={pnl >= 0 ? 'text-[#4ADE80]' : 'text-rose-400'}>
                        {usd(pnl)} (mark {cents(p.lastMark)})
                      </span>
                      <button
                        onClick={() => closePosition(p.id)}
                        className="text-white/30 hover:text-rose-300 cursor-pointer"
                        title="Close at current bid"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {!paper.positions.length && (
                <div className="text-[11px] text-white/30">
                  No positions. Open a market with a BUY signal and press “Paper trade” to track it here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
