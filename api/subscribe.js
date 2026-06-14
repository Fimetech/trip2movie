// POST /api/subscribe — stores a waitlist signup and returns the live waitlist count.
// Body: { email, price?, kind? }   kind = "claim" | "gift"
// De-dupes on email (a refresh/resubmit won't inflate the count).

import { sql, ensureSchema, waitlistCount, WAITLIST_SEED } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const price = body.price === 0 || body.price ? Number(body.price) : null;
  const kind = body.kind === "gift" ? "gift" : body.kind === "claim" ? "claim" : null;

  try {
    if (!sql) {
      console.log("[subscribe] no DB configured — record:", { email, price, kind });
      return res.status(200).json({ ok: true, count: WAITLIST_SEED });
    }
    await ensureSchema();
    await sql`
      INSERT INTO signups (email, price, kind)
      VALUES (${email}, ${price}, ${kind})
      ON CONFLICT (email) DO UPDATE
        SET price = COALESCE(EXCLUDED.price, signups.price),
            kind  = COALESCE(EXCLUDED.kind, signups.kind)
    `;
    const count = await waitlistCount();
    return res.status(200).json({ ok: true, count });
  } catch (e) {
    console.error("[subscribe] error:", e);
    // Never block the user's signup UX on a storage hiccup.
    return res.status(200).json({ ok: true, count: WAITLIST_SEED });
  }
}
