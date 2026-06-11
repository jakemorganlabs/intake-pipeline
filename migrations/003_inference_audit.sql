-- Migration 003: inference_audit
-- Traces to: §11.1, §17.2 Inference Audit Record, FR-PS-2

CREATE TABLE IF NOT EXISTS inference_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    parameters JSONB NOT NULL,
    prompt_hash TEXT,
    raw_output TEXT,
    validation_result TEXT NOT NULL,
    repair_used BOOLEAN NOT NULL DEFAULT false,
    latency_ms INTEGER,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inference_audit_lead_id ON inference_audit(lead_id);
CREATE INDEX IF NOT EXISTS idx_inference_audit_recorded_at ON inference_audit(recorded_at);
CREATE INDEX IF NOT EXISTS idx_inference_audit_validation_result ON inference_audit(validation_result);

COMMENT ON TABLE inference_audit IS 'One row per model call. Makes model behavior inspectable after the fact.';
COMMENT ON COLUMN inference_audit.validation_result IS 'passed | failed | repair_succeeded | repair_failed';
COMMENT ON COLUMN inference_audit.prompt_hash IS 'SHA-256 of the assembled prompt for audit trail';