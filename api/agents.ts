/**
 * GET /api/agents/memory — agent_memory (authenticated). Everything the
 * autonomous bots have learned from real outcomes (channel conversion,
 * incident fixes, market briefs, skills).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc } from "drizzle-orm";
import { db, isDbConfigured } from "../db";
import { agentMemory } from "../db/schema";
import { auth } from "../server/auth";
import { dbUnavailable, getSessionUser, serverError, unauthorized } from "./lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {    if (!isDbConfigured || !db) return dbUnavailable(res);

  try {
    const user = await getSessionUser(req, auth);
    if (!user) return unauthorized(res);
    const rows = await db
      .select()
      .from(agentMemory)
      .orderBy(desc(agentMemory.updated_at));
    return res.status(200).json(rows);
  } catch (error) {
    return serverError(res, error);
  }
}
