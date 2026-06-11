import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export interface FitSignals {
  budget_indicated: boolean | null;
  timeline_urgency: 'low' | 'medium' | 'high' | 'unknown';
  decision_maker: boolean | null;
  use_case_clarity: 'low' | 'medium' | 'high';
}

export interface ValidatedSignals {
  company_size: 'solo' | 'small' | 'mid' | 'enterprise' | 'unknown';
  industry: 'target' | 'adjacent' | 'off' | 'unknown';
  fit_signals: FitSignals;
}

export interface ScoreResult {
  composite: number;
  components: Record<string, number>;
  weights_version: string;
}

let cachedConfig: { schema_version: string; weights: Record<string, number>; factors: Record<string, Record<string, number>> } | null = null;

function loadConfig() {
  if (cachedConfig) return cachedConfig;
  const configPath = resolve(__dirname, '../config/scoring.json');
  const raw = readFileSync(configPath, 'utf-8');
  cachedConfig = JSON.parse(raw);
  return cachedConfig!;
}

export function scoring(
  signals: ValidatedSignals,
  configOverride?: typeof cachedConfig
): ScoreResult {
  const config = configOverride ?? loadConfig();
  const weights = config.weights;
  const factors = config.factors;

  const sizeFactor = factors.company_size[signals.company_size] ?? 0;
  const indFactor = factors.industry[signals.industry] ?? 0;

  const budgetKey =
    signals.fit_signals.budget_indicated === null
      ? 'null'
      : String(signals.fit_signals.budget_indicated);
  const budgetFactor = factors.budget_indicated[budgetKey] ?? 0;

  const urgencyFactor = factors.timeline_urgency[signals.fit_signals.timeline_urgency] ?? 0;

  const dmKey =
    signals.fit_signals.decision_maker === null
      ? 'null'
      : String(signals.fit_signals.decision_maker);
  const dmFactor = factors.decision_maker[dmKey] ?? 0;

  const clarityFactor = factors.use_case_clarity[signals.fit_signals.use_case_clarity] ?? 0;

  const components = {
    size: weights.size * sizeFactor,
    industry: weights.industry * indFactor,
    budget: weights.budget * budgetFactor,
    urgency: weights.urgency * urgencyFactor,
    decision_maker: weights.decision_maker * dmFactor,
    clarity: weights.clarity * clarityFactor,
  };

  const raw = Object.values(components).reduce((sum, v) => sum + v, 0);
  const composite = Math.round(raw);

  return {
    composite,
    components: Object.fromEntries(
      Object.entries(components).map(([k, v]) => [k, parseFloat(v.toFixed(2))])
    ),
    weights_version: config.schema_version,
  };
}
