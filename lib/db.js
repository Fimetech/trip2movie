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

// The displayed waitlist number = WAITLIST_SEED + real signups.
// Obfuscates the true (small) count while still moving with real activity.
export const WAITLIST_SEED = Number(process.env.WAITLIST_SEED || 3120);

let ready = false;
export async function ensureSchema() {
  if (!sql || ready) return;
  await sql`CREATE TABLE IF NOT EXISTS signups (
    id          BIGSERIAL PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    price       NUMERIC,
    kind        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  ready = true;
}

export async function waitlistCount() {
  if (!sql) return WAITLIST_SEED;
  const rows = await sql`SELECT count(*)::int AS n FROM signups`;
  return WAITLIST_SEED + (rows[0]?.n || 0);
}
