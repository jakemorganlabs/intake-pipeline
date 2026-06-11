import { describe, it, expect } from 'vitest';
import { router } from './router.js';

describe('router', () => {
  // HOT
  it('routes to HOT when composite >= 70 and confidence >= 0.6', () => {
    const result = router({ composite: 96, confidence: 0.86 });
    expect(result.tier).toBe('HOT');
    expect(result.actions).toEqual(['chat', 'crm']);
  });

  // FR-RT-4: confidence cap at WARM
  it('caps tier at WARM when high composite but confidence < 0.6', () => {
    const result = router({ composite: 96, confidence: 0.45 });
    expect(result.tier).toBe('WARM');
    expect(result.actions).toEqual(['sheet']);
  });

  // WARM — standard
  it('routes to WARM when composite in [40, 69]', () => {
    const result = router({ composite: 55, confidence: 0.8 });
    expect(result.tier).toBe('WARM');
    expect(result.actions).toEqual(['sheet']);
  });

  // COLD
  it('routes to COLD when composite < 40', () => {
    const result = router({ composite: 12, confidence: 0.9 });
    expect(result.tier).toBe('COLD');
    expect(result.actions).toEqual(['log']);
  });

  // COLD boundary
  it('routes to COLD at composite 39 regardless of confidence', () => {
    const result = router({ composite: 39, confidence: 0.99 });
    expect(result.tier).toBe('COLD');
  });

  // WARM boundary
  it('routes to WARM at composite 40', () => {
    const result = router({ composite: 40, confidence: 0.99 });
    expect(result.tier).toBe('WARM');
  });

  // HOT boundary
  it('routes to HOT at composite 70 when confidence >= 0.6', () => {
    const result = router({ composite: 70, confidence: 0.6 });
    expect(result.tier).toBe('HOT');
  });

  // Low confidence boundary test for cap
  it('capped-to-WARM at exact 0.59 confidence', () => {
    const result = router({ composite: 71, confidence: 0.59 });
    expect(result.tier).toBe('WARM');
  });

  // MANUAL — inference_failed override
  it('routes to MANUAL on inference_failed regardless of score', () => {
    const result = router({ composite: 96, confidence: 0.86, inference_failed: true });
    expect(result.tier).toBe('MANUAL');
    expect(result.actions).toEqual(['dlq', 'alert']);
  });

  it('routes to MANUAL on low score with inference_failed', () => {
    const result = router({ composite: 12, confidence: 0.2, inference_failed: true });
    expect(result.tier).toBe('MANUAL');
    expect(result.actions).toEqual(['dlq', 'alert']);
  });

  // Returns exactly one tier
  it('returns exactly one tier for every valid input', () => {
    const tiers = ['HOT', 'WARM', 'COLD', 'MANUAL'] as const;
    const result = router({ composite: 50, confidence: 0.7 });
    expect(tiers).toContain(result.tier);
    expect(result.tier).toBe('WARM');
  });
});
