-- Migration 001: dedupe table
-- Traces to: §11.1, §10.3 Idempotency Guard, FR-ID-1..3

CREATE TABLE IF NOT EXISTS dedupe (
    idempotency_key TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional cleanup/index for batch operations
CREATE INDEX IF NOT EXISTS idx_dedupe_created_at ON dedupe(created_at);

COMMENT ON TABLE dedupe IS 'Atomic idempotency guard. Insert-if-absent on this table is the gate for exactly-once outcomes.';
COMMENT ON COLUMN dedupe.idempotency_key IS 'Source-stable token derived per §11.3';
