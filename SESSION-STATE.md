# SESSION STATE

## Current State
- Task: Session S01 — Deterministic Core (MICT-PIPE-001)
- Last checkpoint: CKPT 1 — Scaffold + Migrations + Schemas + Core + Tests + CI
- Branch: main
- Next step: Session S01 complete. Handoff to S02 — Orchestration Spine.

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
