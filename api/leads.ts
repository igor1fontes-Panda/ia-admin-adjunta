/**
 * GET /api/leads          — list leads (auth)
 * POST /api/leads         — PUBLIC lead capture (landing page form)
 *
 * The public POST is deliberately restricted: the server forces
 * score ≤ 60, status "new", ai_action null, channel "website" — the exact
 * hardening the old Supabase trigger provided. No session => no write access
 * to any other table.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db, isDbConfigured } from "../db";
import { leads } from "../db/schema";
import { auth } from "../server/auth";
import {
  badRequest,
  dbUnavailable,
  getSessionUser,
  serverError,
  unauthorized,
} from "./lib/http";

const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;
type LeadStatus = (typeof LEAD_STATUSES)[number];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isDbConfigured || !db) return dbUnavailable(res);

  try {
    if (req.method === "GET") {
      const user = await getSessionUser(req, auth);
      if (!user) return unauthorized(res);
      const rows = await db.select().from(leads).orderBy(desc(leads.created_at)).limit(200);
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? safeJson(req.body) : req.body || {};
      const company = str(body.company).trim();
      const contact = str(body.contact_name).trim();
      const email = str(body.email).trim().toLowerCase();
      const niche = str(body.niche).trim() || "SaaS";

      if (!company || !contact || !email) {
        return badRequest(res, "company, contact_name and email are required.");
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) return badRequest(res, "Invalid email address.");

      // If a session exists, the signed-in admin may set privileged fields.
      const user = await getSessionUser(req, auth);
      const privileged = user !== null;
      const rawScore = Number(body.score);
      const score = privileged
        ? Number.isFinite(rawScore)
          ? Math.min(Math.max(Math.round(rawScore), 0), 100)
          : 50
        : Math.min(Number.isFinite(rawScore) ? Math.max(Math.round(rawScore), 0) : 50, 60);
      const status: LeadStatus = privileged && isLeadStatus(body.status) ? body.status : "new";

      const [row] = await db
        .insert(leads)
        .values({
          company,
          contact_name: contact,
          email,
          niche,
          channel: "website",
          score,
          status,
          ai_action: privileged ? (str(body.ai_action).trim() || null) : null,
        })
        .returning();
      return res.status(201).json(row);
    }

    if (req.method === "PATCH") {
      const user = await getSessionUser(req, auth);
      if (!user) return unauthorized(res);
      const id = str(req.query.id);
      if (!id) return badRequest(res, "id query parameter is required.");
      const status = str((bodyOf(req) as { status?: unknown }).status);
      if (!isLeadStatus(status)) return badRequest(res, `status must be one of ${LEAD_STATUSES.join(", ")}.`);
      const [row] = await db.update(leads).set({ status }).where(eq(leads.id, id)).returning();
      if (!row) return res.status(404).json({ error: "Lead not found." });
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
function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);
}
function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}
function bodyOf(req: VercelRequest): unknown {
  return typeof req.body === "string" ? safeJson(req.body) : req.body ?? {};
}
