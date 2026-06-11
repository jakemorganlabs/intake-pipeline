// CLI entry point for the Session S02 pipeline
// Usage: npx tsx src/cli.ts < payload.json

import { runPipeline, type PipelineInput } from './pipeline.js';

async function main() {
  // Read JSON from stdin
  let raw = '';
  process.stdin.setEncoding('utf-8');
  for await (const chunk of process.stdin) {
    raw += chunk;
  }

  const parsed = JSON.parse(raw || '{}');

  const payload: PipelineInput = {
    body: parsed.body || parsed,
    headers: parsed.headers || {},
  };

  const result = await runPipeline(payload);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => {
  console.error(JSON.stringify({ statusCode: 500, body: { error: (e as Error).message } }));
  process.exit(1);
});
