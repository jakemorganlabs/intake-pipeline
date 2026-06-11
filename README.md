# Intake-to-Outbound Intelligence Pipeline

**MICT-PIPE-001** — Session S01: Deterministic Core

The pipeline's decisive logic, the 0–100 composite, the tier selection, the dedupe key,
is pure code. Built first, it becomes the fixed point the rest of the system orbits: scoring and routing are already correct by the time the orchestration spine arrives in S02 to call them.

## Session S01 Scope

- Repository scaffold, dependency manifest, environment template.
- Four Postgres migrations: `dedupe`, `leads`, `inference_audit`, `dead_letter`.
- Two JSON Schema documents: `canonical_lead.schema.json`, `inference_output.schema.json`.
- `scoring.ts` — pure function, validated signals → 0–100 composite, fully unit-tested.
- `router.ts` — pure function, (score, confidence) → tier + action set, fully unit-tested.
- Versioned scoring config (weights, thresholds) externalized per NFR-MA-1.
- Idempotency-key derivation function, unit-tested.
- CI workflow (GitHub Actions) running tests + schema validation on push.

## Quick Start

```bash
cp .env.example .env
# edit .env with your values

npm install
npm run migrate      # apply Postgres migrations
npm test             # run all unit tests
npm run validate:schemas   # validate JSON schemas
```

## Scoring Weights

Weights are versioned external config (`config/scoring.json`), not magic numbers. The `weights_version` field is logged with every score so any composite is fully explainable after the fact.
