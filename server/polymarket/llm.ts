// Optional LLM "analyst" models. Each returns its own probability for a market, which the
// engine adds to the ensemble. Calls are on-demand and cached to keep API spend bounded.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { GoogleGenAI, Type } from '@google/genai';
import * as z from 'zod/v4';
import type { AiOpinion, MarketSignal } from '../../src/polymarket/types';

const CLAUDE_MODEL = 'claude-opus-5-5';
const GEMINI_MODEL = 'gemini-3.5-flash';

const OpinionSchema = z.object({
  probability: z.number().describe('Probability (0-1) that the market resolves YES'),
  confidence: z.number().describe('Confidence in the estimate, 0-1'),
  rationale: z.string().describe('2-4 sentence justification'),
});

let anthropic: Anthropic | null = null;
let gemini: GoogleGenAI | null = null;

export function aiProviders() {
  const g = process.env.GEMINI_API_KEY;
  return {
    claude: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    gemini: Boolean(g && g.trim() && g !== 'MY_GEMINI_API_KEY'),
  };
}

function buildPrompt(s: MarketSignal): string {
  const quant = s.models
    .filter((m) => !m.model.startsWith('ai:'))
    .map((m) => `- ${m.label}: ${(m.probability * 100).toFixed(1)}%${m.note ? ` (${m.note})` : ''}`)
    .join('\n');
  const spot = s.spot;
  return `You are a quantitative crypto analyst estimating the probability that a Polymarket prediction market resolves YES.

Market: "${s.market.question}"
Resolves: ${s.market.endDate} (${s.hoursToExpiry.toFixed(1)} hours from now)
Order book (YES): bid ${s.market.bid.toFixed(3)}, ask ${s.market.ask.toFixed(3)}, 24h volume $${Math.round(s.market.volume24h).toLocaleString()}
${
  spot
    ? `Underlying ${spot.asset}: spot $${spot.price.toLocaleString()}, 24h change ${(spot.change24h * 100).toFixed(2)}%, EWMA vol ${(spot.ewmaVol * 100).toFixed(0)}%/yr, 30d realised vol ${(spot.realizedVol * 100).toFixed(0)}%/yr`
    : ''
}

Quant model estimates:
${quant}

Give your own independent probability. Weigh the resolution wording carefully (touch vs. close, exact time, price source), regime and event risk the quant models miss, and whether the market price already reflects the information. Be calibrated: do not move far from the quant consensus without a concrete reason.`;
}

async function askClaude(s: MarketSignal): Promise<AiOpinion> {
  anthropic ??= new Anthropic();
  const response = await anthropic.beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(OpinionSchema) },
    messages: [{ role: 'user', content: buildPrompt(s) }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Claude declined to estimate this market');
  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Claude returned no structured output');
  return {
    provider: 'claude',
    model: response.model,
    probability: parsed.probability,
    confidence: parsed.confidence,
    rationale: parsed.rationale,
    createdAt: Date.now(),
  };
}

async function askGemini(s: MarketSignal): Promise<AiOpinion> {
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildPrompt(s),
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          probability: { type: Type.NUMBER },
          confidence: { type: Type.NUMBER },
          rationale: { type: Type.STRING },
        },
        required: ['probability', 'confidence', 'rationale'],
      },
    },
  });
  const parsed = OpinionSchema.parse(JSON.parse((response.text ?? '').trim()));
  return { provider: 'gemini', model: GEMINI_MODEL, ...parsed, createdAt: Date.now() };
}

const CACHE_MS = 10 * 60_000;
const cache = new Map<string, AiOpinion[]>();

export function cachedOpinions(marketId: string): AiOpinion[] {
  const hit = cache.get(marketId);
  if (!hit) return [];
  const fresh = hit.filter((o) => Date.now() - o.createdAt < CACHE_MS);
  if (fresh.length !== hit.length) cache.set(marketId, fresh);
  return fresh;
}

type AnalysisResult = { opinions: AiOpinion[]; errors: string[] };
const inFlight = new Map<string, Promise<AnalysisResult>>();

/**
 * Ask every configured provider in parallel; failures are reported, not thrown.
 * Providers with a fresh cached opinion are not called again, and concurrent requests for the
 * same market share one call, so spend is at most one call per provider per market per CACHE_MS.
 */
export function analyzeWithAi(s: MarketSignal): Promise<AnalysisResult> {
  const id = s.market.id;
  const pending = inFlight.get(id);
  if (pending) return pending;
  const run = runAnalysis(s).finally(() => inFlight.delete(id));
  inFlight.set(id, run);
  return run;
}

async function runAnalysis(s: MarketSignal): Promise<AnalysisResult> {
  const enabled = aiProviders();
  if (!enabled.claude && !enabled.gemini) {
    return { opinions: [], errors: ['No AI provider configured. Set ANTHROPIC_API_KEY and/or GEMINI_API_KEY.'] };
  }
  const cached = cachedOpinions(s.market.id);
  const isCached = (p: AiOpinion['provider']) => cached.some((o) => o.provider === p);
  const jobs: Array<Promise<AiOpinion>> = [];
  if (enabled.claude && !isCached('claude')) jobs.push(askClaude(s));
  if (enabled.gemini && !isCached('gemini')) jobs.push(askGemini(s));
  const settled = await Promise.allSettled(jobs);
  const opinions: AiOpinion[] = [...cached];
  const errors: string[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') {
      opinions.push({
        ...r.value,
        probability: Math.min(0.99, Math.max(0.01, r.value.probability)),
        confidence: Math.min(1, Math.max(0, r.value.confidence)),
      });
    } else {
      errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
    }
  }
  if (opinions.length) cache.set(s.market.id, opinions);
  return { opinions, errors };
}
