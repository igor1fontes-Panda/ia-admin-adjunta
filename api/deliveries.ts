/**
 * GET /api/deliveries — delivery_status (authenticated). Real per-pack
 * delivery QA rows written by the Ops Manager and verified by the
 * Error Handler bot.
 */
import type { VercelRequest, VercelResponse } from "./lib/http";
import { desc } from "drizzle-orm";
import { db, isDbConfigured } from "../db";
import { deliveryStatus } from "../db/schema";
import { auth } from "../server/auth";
import { dbUnavailable, getSessionUser, serverError, unauthorized } from "./lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isDbConfigured || !db) return dbUnavailable(res);

  try {
    const user = await getSessionUser(req, auth);
    if (!user) return unauthorized(res);
    const rows = await db.select().from(deliveryStatus).orderBy(desc(deliveryStatus.created_at)).limit(200);
    return res.status(200).json(rows);
  } catch (error) {
    return serverError(res, error);
  }
}
