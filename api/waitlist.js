// GET /api/waitlist — returns the live, DB-backed waitlist number to display.
// count = WAITLIST_SEED + real signups, so it feels established and moves with real activity.

import { ensureSchema, waitlistCount, WAITLIST_SEED } from "../lib/db.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    await ensureSchema();
    const count = await waitlistCount();
    return res.status(200).json({ count });
  } catch (e) {
    console.error("[waitlist] error:", e);
    return res.status(200).json({ count: WAITLIST_SEED });
  }
}
