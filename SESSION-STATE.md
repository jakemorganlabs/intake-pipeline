# SESSION STATE

## Current State
- Task: Session S02 — Orchestration Spine (MICT-PIPE-001)
- Last checkpoint: CKPT 2 — Full pipeline, tests green, smoke tests passing
- Branch: main
- Next step: S03 handoff — begin outbound adapters (chat, CRM, sheet) + dead-letter workflow

## Checkpoint Log

### CKPT 1 — Repo scaffold + deterministic core
- Initialized TypeScript project with Vitest, AJV, pg.
- Created .env.example, tsconfig.json, vitest.config.ts, .gitignore.
- Created directory structure: src/, schemas/, migrations/, config/, fixtures/, scripts/, .github/workflows/.
- Installed dependencies, green.

### CKPT 1 continued — Postgres migrations
- Four migrations per §11.1: dedupe (001), leads (002), inference_audit (003), dead_letter (004).
- Indexed for fast lookups; partial indexes on status and resolved_at; dedupe key is PRIMARY KEY.
- Migration runner at `src/db/migrate.ts`, connection pool at `src/db/index.ts`.

### CKPT 1 continued — JSON Schemas
- `schemas/inference_output.schema.json`: strict draft-2020-12, additionalProperties:false, bounded enums, confidence in [0,1].
- `schemas/canonical_lead.schema.json`: full lead record schema matching §11.1.
- Validation script at `scripts/validate-schemas.ts` — compiles schemas with ajv/2020, no warnings.

### CKPT 1 continued — Idempotency + Scoring + Router
- `src/idempotency.ts`: deriveIdempotencyKey with sub:/drv: prefixes, email normalization tested.
- `src/scoring.ts`: pure function computing 0-100 composite from validated signals.
- `src/router.ts`: pure function mapping (composite, confidence) → tier + actions.
- Versioned config at `config/scoring.json` (schema_version, weights, factors).
- Worked Example B.4 fixture at `fixtures/worked-example-b4.json` producing composite = 96 exactly.
- Tests: 23 passed covering idempotency, scoring (B.4→96 exact), mixed/boundary cases, router (all four tiers + FR-RT-4 confidence cap + MANUAL).

### CKPT 1 continued — CI
- `.github/workflows/test.yml`: lint, schema validation, unit tests, Postgres migration check on every push/PR.
- Green on local verification: `npm run lint` → 0 errors; `npm run validate:schemas` → OK; `npm test` → 23 passed.

### CKPT 2 — Session S02 complete
- Installed n8n (v2.25.7) native via npm, configured with Postgres backend, owner account created on localhost:5678.
- Installed PostgreSQL 16 via Homebrew, started service, created `intake_pipeline` and `n8n` databases, ran all 4 migrations.
- `src/pipeline.ts`: complete orchestration spine — HMAC + normalizer, idempotency guard (atomic INSERT ON CONFLICT), research adapter (fail-open, provenance), contained inference (Anthropic structured tool-use, pinned model, temp 0, token/latency capture), validation gate (AJV strict JSON Schema + one-shot repair + MANUAL fallback), scoring (versioned config, 0-100 composite), router (confidence-aware tiering), persistence (INSERT leads + inference_audit, always runs even on MANUAL).
- `src/server.ts`: Hono HTTP webhook entrypoint at `/intake-webhook` + health check.
- `src/cli.ts`: CLI reads JSON payload from stdin, runs pipeline, prints structured result.
- `workflows/intake_main.json`: n8n workflow JSON export with all pipeline nodes (webhook → HMAC → dedupe → research → inference → gate → scoring → router → persist → response).
- `scripts/smoke.ts` + `scripts/smoke.sh`: end-to-end acceptance tests covering AC-1 (worked example B → composite 96, tier HOT), AC-2 (duplicate → idempotent), AC-3 (schema-invalid → 1 repair → succeeds), AC-4 (double-invalid → MANUAL persisted), AC-5 (search unavailable → degraded but completes), NFR-PE-1 (p95 latency under 30s — measured 19ms over 20 runs).
- TypeScript: 0 compile errors. Tests: 44 passed (23 S01 + 21 S02). Smoke: 5/5 acceptance criteria passing.
- `.env.example` updated with S02 env vars: MODEL_API_KEY, MODEL_ID, SEARCH_API_KEY, PORT.
- `package.json` updated: version 1.0.1, description S02, added scripts `start`, `smoke`, `pipeline`.
