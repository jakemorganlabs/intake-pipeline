// HTTP webhook entry point for the Intake Pipeline
// Runs the full orchestration spine on each POST to /intake-webhook

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { runPipeline } from './pipeline.js';

const app = new Hono();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.post('/intake-webhook', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((v, k) => { headers[k] = v; });

  const result = await runPipeline({ body, headers });
  return c.json(result.body as Record<string, unknown>, result.statusCode as 200 | 400 | 401 | 503);
});

// Health check
app.get('/health', async (c) => {
  return c.json({ status: 'ok', pipeline: 's02-orchestration-spine' });
});

const startedAt = new Date().toISOString();
console.log(`[${startedAt}] Intake Pipeline Server — Session S02`);
console.log(`POST http://localhost:${PORT}/intake-webhook`);
console.log(`GET  http://localhost:${PORT}/health`);

serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

export { app };
