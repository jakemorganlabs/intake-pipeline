-- Migration 004: dead_letter
-- Traces to: §10.11 Error Workflow / Dead-Letter Handler, FR-ER-1

CREATE TABLE IF NOT EXISTS dead_letter (
    dlq_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_snapshot JSONB NOT NULL,
    stage TEXT NOT NULL,
    error TEXT NOT NULL,
    error_detail JSONB,
    alert_raised BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_created_at ON dead_letter(created_at);
CREATE INDEX IF NOT EXISTS idx_dead_letter_resolved_at ON dead_letter(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dead_letter_alert_raised ON dead_letter(alert_raised) WHERE resolved_at IS NULL;

COMMENT ON TABLE dead_letter IS 'Global error sink. Every unhandled stage failure converges here + operator alert.';
COMMENT ON COLUMN dead_letter.lead_snapshot IS 'Full lead state at time of failure so nothing is lost.';
COMMENT ON COLUMN dead_letter.stage IS 'The pipeline stage where the failure occurred (e.g. research, inference, outbound).';
COMMENT ON COLUMN dead_letter.error IS 'Human-readable error summary.';
COMMENT ON COLUMN dead_letter.error_detail IS 'Structured error payload for triage and filtering.';
COMMENT ON COLUMN dead_letter.alert_raised IS 'Whether an operator alert was emitted for this item.';
