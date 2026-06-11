-- Migration 002: leads (canonical lead record)
-- Traces to: §11.1, FR-PS-1

CREATE TABLE IF NOT EXISTS leads (
    lead_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE REFERENCES dedupe(idempotency_key),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'received',
    source JSONB NOT NULL DEFAULT '{}',
    raw_submission JSONB NOT NULL DEFAULT '{}',
    normalized JSONB NOT NULL DEFAULT '{}',
    web_research JSONB,
    enrichment JSONB,
    score JSONB,
    routing JSONB,
    errors JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial indexes for fast routing-tier lookups
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_received_at ON leads(received_at);
CREATE INDEX IF NOT EXISTS idx_leads_idempotency_key ON leads(idempotency_key);

COMMENT ON TABLE leads IS 'Canonical lead record. One row per processed submission with full provenance.';
COMMENT ON COLUMN leads.status IS 'received | enriched | scored | routed | inference_failed | delivery_failed';
COMMENT ON COLUMN leads.source IS '{ form_id, form_name }';
COMMENT ON COLUMN leads.normalized IS '{ name, email, domain, company, message }';
COMMENT ON COLUMN leads.web_research IS '{ status, fetched_at, results[] }';
COMMENT ON COLUMN leads.enrichment IS '{ company_size, industry, fit_signals, summary, confidence, model, schema_version, repair_used, extracted_at }';
COMMENT ON COLUMN leads.score IS '{ composite, components, weights_version, scored_at }';
COMMENT ON COLUMN leads.routing IS '{ tier, actions[], routed_at }';
