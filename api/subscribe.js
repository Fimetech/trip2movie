// POST /api/subscribe — stores a waitlist signup and returns the live waitlist count.
// Body: { email, wtp_price?, kind? }   kind = "claim" | "gift"
// De-dupes on email (a refresh/resubmit won't inflate the count).

import { sql, ensureSchema, waitlistCount, displayWaitlistCount } from "../lib/db.js";

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

  const wtpPrice = body.wtp_price === 0 || body.wtp_price ? Number(body.wtp_price) : null;
  const kind = body.kind === "gift" ? "gift" : body.kind === "claim" ? "claim" : null;

  try {
    if (!sql) {
      console.log("[subscribe] no DB configured — record:", { email, wtp_price: wtpPrice, kind });
      return res.status(200).json({ ok: true, count: displayWaitlistCount(0) });
    }
    await ensureSchema();
    await sql`
      INSERT INTO signups (email, wtp_price, kind)
      VALUES (${email}, ${wtpPrice}, ${kind})
      ON CONFLICT (email) DO UPDATE
        SET wtp_price = COALESCE(EXCLUDED.wtp_price, signups.wtp_price),
            kind      = COALESCE(EXCLUDED.kind, signups.kind)
    `;
    const count = await waitlistCount();
    return res.status(200).json({ ok: true, count });
  } catch (e) {
    console.error("[subscribe] error:", e);
    // Never block the user's signup UX on a storage hiccup.
    return res.status(200).json({ ok: true, count: displayWaitlistCount(0) });
  }
}
