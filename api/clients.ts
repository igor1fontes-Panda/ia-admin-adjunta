/**
 * Clients API (authenticated):
 *   GET   /api/clients        — list
 *   POST  /api/clients        — create (MRR derived from plan)
 *   PATCH /api/clients?id=…   — update status/plan
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db, isDbConfigured } from "../db";
import { clients } from "../db/schema";
import { auth } from "../server/auth";
import { badRequest, dbUnavailable, getSessionUser, serverError, unauthorized } from "./lib/http";

const PLANS = { starter: "1250.00", professional: "2916.00", enterprise: "8333.00" } as const;
type Plan = keyof typeof PLANS;
const CLIENT_STATUSES = ["active", "trialing", "churned"] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {    if (!isDbConfigured || !db) return dbUnavailable(res);

  try {
    const user = await getSessionUser(req, auth);
    if (!user) return unauthorized(res);

    if (req.method === "GET") {
      const rows = await db.select().from(clients).orderBy(desc(clients.created_at)).limit(200);
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const body = bodyOf(req);
      const name = str(body.name).trim();
      const email = str(body.email).trim().toLowerCase();
      const plan = str(body.plan) as Plan;
      if (!name || !email) return badRequest(res, "name and email are required.");
      if (!(plan in PLANS)) return badRequest(res, "plan must be starter, professional or enterprise.");
      const [row] = await db
        .insert(clients)
        .values({ name, email, plan, mrr: PLANS[plan], status: "active" })
        .returning();
      return res.status(201).json(row);
    }

    if (req.method === "PATCH") {
      const id = str(req.query.id);
      if (!id) return badRequest(res, "id query parameter is required.");
      const body = bodyOf(req) as { status?: unknown; plan?: unknown };
      const patch: { status?: string; plan?: Plan; mrr?: string } = {};
      if (typeof body.status === "string") {
        if (!(CLIENT_STATUSES as readonly string[]).includes(body.status)) {
          return badRequest(res, `status must be one of ${CLIENT_STATUSES.join(", ")}.`);
        }
        patch.status = body.status;
      }
      if (typeof body.plan === "string") {
        if (!(body.plan in PLANS)) return badRequest(res, "plan must be starter, professional or enterprise.");
        patch.plan = body.plan as Plan;
        patch.mrr = PLANS[body.plan as Plan];
      }
      if (Object.keys(patch).length === 0) return badRequest(res, "Nothing to update.");
      const [row] = await db.update(clients).set(patch).where(eq(clients.id, id)).returning();
      if (!row) return res.status(404).json({ error: "Client not found." });
      return res.status(200).json(row);
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    return serverError(res, error);
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function bodyOf(req: VercelRequest): Record<string, unknown> {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (req.body as Record<string, unknown>) ?? {};
}
