// GET /api/waitlist — returns the live signup count from the database.

import { ensureSchema, waitlistCount } from "../lib/db.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    await ensureSchema();
    const count = await waitlistCount();
    return res.status(200).json({ count });
  } catch (e) {
    console.error("[waitlist] error:", e);
    return res.status(200).json({ count: 0 });
  }
}
