# Intake-to-Outbound Intelligence Pipeline

**MICT-PIPE-001** — Session S02: Orchestration Spine

A lead-intelligence pipeline that receives a public form submission, enriches it with web research and a single contained language-model inference, scores it with deterministic rules, and routes it to one of three outbound tiers. The model is confined to one validated call — it proposes structure; deterministic code disposes.

## Current State

- **S01** (complete): Deterministic core — scoring, routing, keys, schemas, migrations.
- **S02** (complete): Orchestration spine — HMAC auth, dedupe idempotency, web research (fail-open), contained inference (Anthropic structured tool-use), validation gate (AJV + one repair), pipeline wiring, persistence, audit, HTTP endpoint, smoke tests.
- **S03** (upcoming): Outbound adapters (chat, CRM, sheet), global error workflow.

## Architecture

```
[1] Webhook → [2] HMAC/Normalize → [3] Dedupe Guard
                                       ↓
[4] Web Research (fail-open) → [5] Contained Inference (Anthropic, temp 0)
                                       ↓
                        [6] Validation Gate (AJV + one repair)
                                       ↓
                        [7] Scoring (pure fn, 0–100)
                                       ↓
                        [8] Router (HOT/WARM/COLD/MANUAL)
                                       ↓
                        [9] Persistence (leads + inference_audit)
```

## Quick Start

```bash
cp .env.example .env
# edit .env with your DATABASE_URL, MODEL_API_KEY, SEARCH_API_KEY, WEBHOOK_SECRET

npm install
npm run migrate                # apply Postgres migrations
npm test                       # run all unit tests (44 passing)
npm run validate:schemas       # validate JSON schemas
npm run smoke                  # end-to-end acceptance test
npm start                      # start HTTP server on PORT (default 3001)
```

## Key Files

| File | Purpose |
|---|---|
| `src/pipeline.ts` | Full orchestration spine — all stages wired |
| `src/server.ts` | Hono HTTP webhook receiver |
| `src/cli.ts` | CLI entry for stdin pipeline execution |
| `src/scoring.ts` | Deterministic 0–100 composite scoring |
| `src/router.ts` | Confidence-aware tier routing |
| `src/idempotency.ts` | Key derivation per §11.3 |
| `schemas/inference_output.schema.json` | Strict JSON Schema gate for model output |
| `config/scoring.json` | Versioned weights + factors per NFR-MA-1 |
| `scripts/smoke.ts` | End-to-end acceptance test (AC-1..AC-5) |
| `workflows/intake_main.json` | n8n workflow export (Stage S03 will activate) |

## Design Principles

- **Containment**: The model is given one job — emit a structured object. Its output is checked against a strict schema before it is allowed to influence anything downstream.
- **Validation gate**: `additionalProperties: false`, enumerated values, bounded ranges. On failure: one repair, then MANUAL.
- **Fail-open research**: Web search timeout/error → degraded flag, pipeline continues.
- **Atomic dedupe**: `INSERT ... ON CONFLICT DO NOTHING` against `dedupe` table.
- **Audit trail**: Every model call writes a row with model id, tokens, latency, validation result, repair_used.

## Session S01 Scope

- Repository scaffold, dependency manifest, environment template.
- Four Postgres migrations: `dedupe`, `leads`, `inference_audit`, `dead_letter`.
- Two JSON Schema documents: `canonical_lead.schema.json`, `inference_output.schema.json`.
- `scoring.ts` — pure function, validated signals → 0–100 composite, fully unit-tested.
- `router.ts` — pure function, (score, confidence) → tier + action set, fully unit-tested.
- Versioned scoring config externalized per NFR-MA-1.
- Idempotency-key derivation function, unit-tested.
- CI workflow (GitHub Actions) running tests + schema validation on push.

## Session S02 Scope

- Postgres (Homebrew) + n8n (native) installed and running.
- `src/pipeline.ts`: full 9-stage pipeline with typed interfaces and pure/deterministic stages.
- HMAC verification with timing-safe comparison.
- Dedupe guard: atomic insert-if-absent, short-circuits duplicates with 200.
- Research adapter: Brave Search HTTP call with provenance, fail-open on any error.
- Contained inference: Anthropic structured tool-use (claude-3-5-haiku-20241022, `temperature: 0`), token + latency capture.
- Validation gate: strict JSON Schema via AJV draft-2020-12, one repair attempt with safe heuristics, MANUAL on double failure.
- Scoring and routing wired from S01 modules (no duplication).
- Persistence: `leads` + `inference_audit` INSERT with ON CONFLICT UPDATE, always runs even on MANUAL.
- HTTP server (`src/server.ts`): `POST /intake-webhook` + `GET /health`.
- Smoke tests (`scripts/smoke.ts` / `smoke.sh`): 5 acceptance criteria verified:
  - AC-1: Worked Example B → composite 96, tier HOT.
  - AC-2: Duplicate → idempotent, one row.
  - AC-3: Schema-invalid → one repair → succeeds.
  - AC-4: Double-invalid → MANUAL persisted.
  - AC-5: Search unavailable → degraded completes.
  - NFR-PE-1: p95 = 19ms over 20 runs (< 30s budget).
- n8n workflow JSON exported to `workflows/intake_main.json` (S03 refinement).
- 44 tests passing (23 S01 + 21 S02), TypeScript 0 errors.
