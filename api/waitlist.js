// GET /api/waitlist — returns the displayed waitlist count (derived from real signups).

import { ensureSchema, waitlistCount, displayWaitlistCount } from "../lib/db.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    await ensureSchema();
    const count = await waitlistCount();
    return res.status(200).json({ count });
  } catch (e) {
    console.error("[waitlist] error:", e);
    return res.status(200).json({ count: displayWaitlistCount(0) });
  }
}
