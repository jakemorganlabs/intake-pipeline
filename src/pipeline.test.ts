import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import 'dotenv/config';
import {
  hmacAndNormalize,
  deriveIdempotencyKey,
  webResearch,
  validationGate,
  scoring,
  router,
  runPipeline,
  type NormalizedLead,
  type PipelineInput,
  type PipelineOverrides,
  type InferenceResult,
  type WebResearch,
} from './pipeline.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/intake_pipeline';

async function resetTables() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query('TRUNCATE leads, dedupe, inference_audit, dead_letter CASCADE');
  await client.end();
}

async function countRows(table: string): Promise<number> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
  await client.end();
  return parseInt(result.rows[0].count, 10);
}

describe('Pipeline', () => {
  beforeAll(async () => {
    await resetTables();
  });

  afterAll(async () => {
    await resetTables();
  });

  describe('S01: hmacAndNormalize (FR-IN-3, FR-IN-4)', () => {
    it('normalizes a valid payload', () => {
      const result = hmacAndNormalize({
        body: { name: 'Dana Reyes', email: 'dreyes@northgate-medical.example', message: 'Hello' },
      });
      expect(result.response).toBeUndefined();
      expect(result.normalized.name).toBe('Dana Reyes');
      expect(result.normalized.email).toBe('dreyes@northgate-medical.example');
      expect(result.normalized.domain).toBe('northgate-medical.example');
    });

    it('returns 400 on missing fields', () => {
      const result = hmacAndNormalize({ body: { name: 'Dana' } });
      expect(result.response?.statusCode).toBe(400);
    });

    it('returns 400 on invalid email', () => {
      const result = hmacAndNormalize({ body: { name: 'Dana', email: 'not-an-email', message: 'Hello' } });
      expect(result.response?.statusCode).toBe(400);
    });

    it('trims and lowercases email', () => {
      const result = hmacAndNormalize({ body: { name: 'Dana', email: '  Dana@EXAMPLE.COM  ', message: 'Hi' } });
      expect(result.normalized.email).toBe('dana@example.com');
    });
  });

  describe('S01: deriveIdempotencyKey (FR-ID-1)', () => {
    it('uses provider submission id when present', () => {
      const key = deriveIdempotencyKey('abc', 'email@test.com', 'form1', '2026-01-01');
      expect(key).toBe('sub:abc');
    });

    it('derives key from hash when no submission id', () => {
      const key = deriveIdempotencyKey(null, 'email@test.com', 'form1', '2026-01-01');
      expect(key).toBeTruthy();
      expect(key.startsWith('drv:')).toBe(true);
    });
  });

  describe('S02: webResearch (FR-WR-2, NFR-RE-2)', () => {
    it('fails open with degraded when no key', async () => {
      const result = await webResearch('example.com', 'Acme');
      expect(result.status).toBe('degraded');
      expect(result.degraded).toBe(true);
      expect(result.results).toEqual([]);
    });
  });

  describe('S02: validationGate (FR-AI-3, FR-AI-4)', () => {
    it('accepts valid output', () => {
      const valid = {
        company_size: 'mid',
        industry: 'healthcare',
        fit_signals: { budget_indicated: true, timeline_urgency: 'high', decision_maker: true, use_case_clarity: 'high' },
        summary: 'Mid-size healthcare',
        confidence: 0.86,
      };
      const result = validationGate(valid);
      expect(result.valid).toBe(true);
      expect(result.repair_used).toBe(false);
    });

    it('repairs once on schema violation', () => {
      const invalid = {
        company_size: 'mid',
        industry: 'healthcare',
        fit_signals: { budget_indicated: true, timeline_urgency: 'high', decision_maker: true },
        summary: 'Missing use_case_clarity',
        confidence: 0.86,
      };
      const result = validationGate(invalid);
      expect(result.valid).toBe(true);
      expect(result.repair_used).toBe(true);
    });

    it('fails to MANUAL on double violation', () => {
      const bad = {
        company_size: 'extralarge',
        industry: 'healthcare',
        fit_signals: { budget_indicated: true, timeline_urgency: 'high', decision_maker: true },
        summary: 'broken',
        confidence: 5,
      };
      const result = validationGate(bad);
      expect(result.valid).toBe(false);
      expect(result.repair_used).toBe(true);
    });

    it('fails on null model output', () => {
      const result = validationGate(null);
      expect(result.valid).toBe(false);
      expect(result.repair_used).toBe(false);
    });
  });

  describe('S01: scoring (FR-SC-1)', () => {
    it('produces composite 96 for Worked Example B signals', () => {
      const enrichment = {
        company_size: 'mid',
        industry: 'healthcare',
        fit_signals: { budget_indicated: true, timeline_urgency: 'high', decision_maker: true, use_case_clarity: 'high' },
        confidence: 0.86,
      };
      // Search-relevant: industry classification 
      const result = scoring(enrichment);
      expect(result.composite).toBe(96);
      expect(result.components).toBeDefined();
    });
  });

  describe('S01: router (FR-RT-1, FR-RT-4)', () => {
    it('routes composite >=70 and confidence >=0.6 as HOT', () => {
      expect(router(96, 0.86, false).tier).toBe('HOT');
    });

    it('caps high score + low confidence at WARM (FR-RT-4)', () => {
      expect(router(96, 0.5, false).tier).toBe('WARM');
    });

    it('routes 40-69 as WARM', () => {
      expect(router(50, 0.8, false).tier).toBe('WARM');
    });

    it('routes <40 as COLD', () => {
      expect(router(30, 0.9, false).tier).toBe('COLD');
    });

    it('always routes inference_failed as MANUAL', () => {
      expect(router(96, 0.86, true).tier).toBe('MANUAL');
    });
  });

  describe('S02: end-to-end runPipeline with mocked inference', () => {
    const mockInference = async (_n: NormalizedLead, _r: WebResearch): Promise<{ result: InferenceResult; error?: string }> => ({
      result: {
        model: 'claude-3-5-haiku-20241022',
        raw_output: {
          company_size: 'mid',
          industry: 'healthcare',
          fit_signals: { budget_indicated: true, timeline_urgency: 'high', decision_maker: true, use_case_clarity: 'high' },
          summary: 'Mid-size healthcare opening an 18k sqft clinic in Q3; needs Cat6A + server room; budget approved; quote within a month.',
          confidence: 0.86,
        },
        latency_ms: 3500,
        input_tokens: 1200,
        output_tokens: 280,
        started_at: new Date().toISOString(),
      },
    });

    const workedExampleB: PipelineInput = {
      body: {
        name: 'Dana Reyes',
        email: 'dreyes@northgate-medical.example',
        message: 'Opening an 18,000 sq ft outpatient clinic in Q3. Need Cat6A throughout plus a small server room. Quote needed by end of month — budget is approved.',
        company: 'Northgate Medical Group',
        form_id: 'contact-form-001',
        submitted_at: '2026-05-28T10:00:00Z',
        submission_id: 'submission-b-001',
      },
      headers: {},
    };

    it('Worked Example B → lead persisted with composite 96, tier HOT (§B)', async () => {
      await resetTables();
      const overrides: PipelineOverrides = { inference: mockInference };
      const result = await runPipeline(workedExampleB, overrides);

      expect(result.statusCode).toBe(200);
      expect(result.body.status).toBe('routed');
      expect(result.body.routing).toEqual({ tier: 'HOT', actions: ['chat', 'crm'] });
      const score = result.body.score as { composite?: number } | undefined;
      expect(score?.composite).toBe(96);
      expect(result.body.degraded).toBe(true); // no search key → degraded but succeeds

      // Verify DB state
      const leadCount = await countRows('leads');
      expect(leadCount).toBe(1);
      const auditCount = await countRows('inference_audit');
      expect(auditCount).toBe(1);
    });

    it('duplicate submission within dedupe window → 200, no second row (FR-ID-2)', async () => {
      const overrides: PipelineOverrides = { inference: mockInference };
      const result1 = await runPipeline(workedExampleB, overrides);
      expect(result1.statusCode).toBe(200);

      const result2 = await runPipeline(workedExampleB, overrides);
      expect(result2.statusCode).toBe(200);

      // Only one lead row
      const leadCount = await countRows('leads');
      expect(leadCount).toBe(1);

      // Should be two audit rows (one per run) if we check — but the dedupe prevents duplicate
      // Actually the persist logic does ON CONFLICT UPDATE so lead_count stays 1
    });

    it('schema-invalid model response triggers exactly one repair and succeeds', async () => {
      await resetTables();
      const repairMock = async (): Promise<{ result: InferenceResult; error?: string }> => ({
        result: {
          model: 'claude-3-5-haiku-20241022',
          raw_output: {
            company_size: 'mid',
            industry: 'healthcare',
            fit_signals: { budget_indicated: true, timeline_urgency: 'high', decision_maker: true },
            summary: 'Missing use_case_clarity field',
            confidence: 0.8,
          },
          latency_ms: 3200,
          input_tokens: 1100,
          output_tokens: 200,
          started_at: new Date().toISOString(),
        },
      });

      const overrides: PipelineOverrides = { inference: repairMock };
      const result = await runPipeline(workedExampleB, overrides);

      expect(result.statusCode).toBe(200);
      expect(result.body.status).toBe('routed');
      expect(result.body.repair_used).toBe(true);
    });

    it('double schema-invalid response → MANUAL with lead persisted', async () => {
      await resetTables();
      const doubleInvalidMock = async (): Promise<{ result: InferenceResult; error?: string }> => ({
        result: {
          model: 'claude-3-5-haiku-20241022',
          raw_output: {
            company_size: 'extralarge',
            industry: 'healthcare',
            fit_signals: { budget_indicated: true, timeline_urgency: 'high', decision_maker: true },
            summary: 'Bad size and missing clarity',
            confidence: 999,
          },
          latency_ms: 3200,
          input_tokens: 1100,
          output_tokens: 200,
          started_at: new Date().toISOString(),
        },
      });

      const overrides: PipelineOverrides = { inference: doubleInvalidMock };
      const result = await runPipeline(workedExampleB, overrides);

      expect(result.statusCode).toBe(200);
      expect(result.body.status).toBe('inference_failed');
      const routing = result.body.routing as { tier?: string } | undefined;
      expect(routing?.tier).toBe('MANUAL');

      // Assert lead was persisted even on MANUAL
      const leadCount = await countRows('leads');
      expect(leadCount).toBe(1);
      const auditCount = await countRows('inference_audit');
      expect(auditCount).toBe(1);
    });
  });
});
