import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// @ts-expect-error ESM interop with CJS default export
const ajv = new Ajv2020({ strict: true, allErrors: true });
// @ts-expect-error ESM interop with CJS default export
addFormats(ajv);

function validateSchema(path: string, name: string): void {
  const raw = readFileSync(path, 'utf-8');
  const schema = JSON.parse(raw);
  try {
    // compile implicitly validates the schema + precompiles it
    ajv.compile(schema);
    console.log(`[OK] ${name} compiles without errors`);
  } catch (err) {
    console.error(`Schema validation failed for ${name}:`);
    console.error(err);
    process.exit(1);
  }
}

const schemas = [
  { path: resolve('schemas/inference_output.schema.json'), name: 'inference_output' },
  { path: resolve('schemas/canonical_lead.schema.json'), name: 'canonical_lead' },
];

for (const s of schemas) {
  validateSchema(s.path, s.name);
}

console.log('[OK] All schemas validated');
