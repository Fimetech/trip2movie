// Shared DB layer (Supabase Postgres over the porsager `postgres` driver).
// Use the Supabase *Transaction pooler* connection string (port 6543) as DATABASE_URL.
// `prepare: false` is required — the transaction pooler doesn't support prepared statements.
// If no connection string is present (e.g. local static preview), everything degrades to a
// safe no-op so the page keeps working.

import postgres from "postgres";

const CONN =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  null;

export const sql = CONN ? postgres(CONN, { prepare: false }) : null;

let ready = false;
export async function ensureSchema() {
  if (!sql || ready) return;
  await sql`CREATE TABLE IF NOT EXISTS signups (
    id          BIGSERIAL PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    wtp_price   NUMERIC,
    kind        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  // Migrate legacy `price` column if the table predates the rename.
  await sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'signups' AND column_name = 'price'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'signups' AND column_name = 'wtp_price'
      ) THEN
        ALTER TABLE signups RENAME COLUMN price TO wtp_price;
      END IF;
    END $$
  `;
  ready = true;
}

export async function waitlistCount() {
  if (!sql) return 0;
  const rows = await sql`SELECT count(*)::int AS n FROM signups`;
  return rows[0]?.n || 0;
}
