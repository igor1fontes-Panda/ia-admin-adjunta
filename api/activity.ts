/**
 * GET /api/activity — activity feed (authenticated). Real bot/system/sale/lead
 * events only; the initialization note is filtered out like the old UI did.
 */
import type { VercelRequest, VercelResponse } from "./lib/http";
import { desc } from "drizzle-orm";
import { db, isDbConfigured } from "../db";
import { activityLog } from "../db/schema";
import { auth } from "../server/auth";
import { dbUnavailable, getSessionUser, serverError, unauthorized } from "./lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isDbConfigured || !db) return dbUnavailable(res);

  try {
    const user = await getSessionUser(req, auth);
    if (!user) return unauthorized(res);
    const rows = await db.select().from(activityLog).orderBy(desc(activityLog.created_at)).limit(50);
    return res.status(200).json(rows.filter((r) => !/^Database initialized/i.test(r.message)));
  } catch (error) {
    return serverError(res, error);
  }
}
