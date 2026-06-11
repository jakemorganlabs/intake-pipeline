import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/intake_pipeline';

export const pool = new Pool({
  connectionString: DATABASE_URL,
  // Fail fast in CI
  connectionTimeoutMillis: 5000,
});
