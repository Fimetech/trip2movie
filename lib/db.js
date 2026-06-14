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

/** Raw signup rows in the database. */
export async function realWaitlistCount() {
  if (!sql) return 0;
  const rows = await sql`SELECT count(*)::int AS n FROM signups`;
  return rows[0]?.n || 0;
}

/**
 * Map real signups → the number shown on the page.
 *
 * Piecewise curve: exact target ratios at milestones, linear shown-count
 * interpolation between them (always increases, +1 per signup in the tail).
 *
 * Milestone ratios: 7× @5, 6.5× @10, 5.8× @15, 4.7× @20, 4.1× @25, 3.6× @30,
 * then fades toward ~1× as the list grows.
 */
const DISPLAY_CURVE = [
  [0, 18],
  [5, 35],    // 7.0×
  [10, 65],   // 6.5×
  [15, 87],   // 5.8×
  [20, 94],   // 4.7×
  [25, 103],  // 4.1×
  [30, 108],  // 3.6×
  [50, 128],  // 2.6×
  [100, 178], // 1.8×
  [500, 548], // 1.1×
];

export function displayWaitlistCount(real) {
  const n = Math.max(0, Math.floor(Number(real) || 0));
  const last = DISPLAY_CURVE[DISPLAY_CURVE.length - 1];
  if (n >= last[0]) return Math.round(last[1] + (n - last[0]));
  for (let i = 0; i < DISPLAY_CURVE.length - 1; i++) {
    const [n0, s0] = DISPLAY_CURVE[i];
    const [n1, s1] = DISPLAY_CURVE[i + 1];
    if (n >= n0 && n <= n1) {
      const t = (n - n0) / (n1 - n0);
      return Math.round(s0 + t * (s1 - s0));
    }
  }
  return last[1];
}

/** Display count for APIs and the landing page (real count passed through displayWaitlistCount). */
export async function waitlistCount() {
  const real = await realWaitlistCount();
  return displayWaitlistCount(real);
}
