import { describe, it, expect } from 'vitest';
import { scoring, type ValidatedSignals } from './scoring.js';

const CONFIG = {
  schema_version: '1.0',
  weights: {
    size: 20,
    industry: 15,
    budget: 20,
    urgency: 15,
    decision_maker: 15,
    clarity: 15,
  },
  factors: {
    company_size: {
      enterprise: 1.0,
      mid: 0.8,
      small: 0.5,
      solo: 0.3,
      unknown: 0.2,
    },
    industry: {
      target: 1.0,
      adjacent: 0.6,
      off: 0.2,
      unknown: 0.3,
    },
    budget_indicated: {
      true: 1.0,
      false: 0.2,
      null: 0.4,
    },
    timeline_urgency: {
      high: 1.0,
      medium: 0.6,
      low: 0.3,
      unknown: 0.4,
    },
    decision_maker: {
      true: 1.0,
      false: 0.3,
      null: 0.4,
    },
    use_case_clarity: {
      high: 1.0,
      medium: 0.6,
      low: 0.2,
    },
  },
};

describe('scoring', () => {
  // Worked Example B.4 from MICT-PIPE-001
  it('produces composite = 96 for Worked Example B.4', () => {
    const signals: ValidatedSignals = {
      company_size: 'mid',
      industry: 'target',
      fit_signals: {
        budget_indicated: true,
        timeline_urgency: 'high',
        decision_maker: true,
        use_case_clarity: 'high',
      },
    };
    const result = scoring(signals, CONFIG);
    expect(result.composite).toBe(96);
    expect(result.weights_version).toBe('1.0');
  });

  it('includes all six component contributions', () => {
    const signals: ValidatedSignals = {
      company_size: 'mid',
      industry: 'target',
      fit_signals: {
        budget_indicated: true,
        timeline_urgency: 'high',
        decision_maker: true,
        use_case_clarity: 'high',
      },
    };
    const result = scoring(signals, CONFIG);
    expect(result.components).toMatchObject({
      size: 16.0,
      industry: 15.0,
      budget: 20.0,
      urgency: 15.0,
      decision_maker: 15.0,
      clarity: 15.0,
    });
  });

  it('handles all-low signals (minimum possible composite)', () => {
    const signals: ValidatedSignals = {
      company_size: 'unknown',
      industry: 'unknown',
      fit_signals: {
        budget_indicated: null,
        timeline_urgency: 'unknown',
        decision_maker: null,
        use_case_clarity: 'low',
      },
    };
    const result = scoring(signals, CONFIG);
    expect(result.composite).toBeGreaterThanOrEqual(0);
    expect(result.composite).toBeLessThanOrEqual(100);
  });

  it('handles mixed signals', () => {
    const signals: ValidatedSignals = {
      company_size: 'small',
      industry: 'adjacent',
      fit_signals: {
        budget_indicated: true,
        timeline_urgency: 'medium',
        decision_maker: false,
        use_case_clarity: 'medium',
      },
    };
    const result = scoring(signals, CONFIG);
    // manual: size=10, ind=9, budget=20, urgency=9, dm=4.5, clarity=9 => total=61.5 => 62
    expect(result.composite).toBe(62);
  });

  it('caps composite at 100 for perfect signals', () => {
    const signals: ValidatedSignals = {
      company_size: 'enterprise',
      industry: 'target',
      fit_signals: {
        budget_indicated: true,
        timeline_urgency: 'high',
        decision_maker: true,
        use_case_clarity: 'high',
      },
    };
    const result = scoring(signals, CONFIG);
    expect(result.composite).toBe(100);
  });

  it('uses weights_version from config', () => {
    const customConfig = JSON.parse(JSON.stringify(CONFIG));
    customConfig.schema_version = '2.0-beta';
    const signals: ValidatedSignals = {
      company_size: 'mid',
      industry: 'target',
      fit_signals: {
        budget_indicated: true,
        timeline_urgency: 'high',
        decision_maker: true,
        use_case_clarity: 'high',
      },
    };
    const result = scoring(signals, customConfig);
    expect(result.weights_version).toBe('2.0-beta');
  });
});
