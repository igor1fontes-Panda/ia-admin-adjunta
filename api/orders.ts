/**
 * Orders API (authenticated):
 *   GET   /api/orders        — list
 *   POST  /api/orders        — create with generated payment reference
 *   PATCH /api/orders?id=…   — update status (mark paid / refunded)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, eq } from "drizzle-orm";
import { db, isDbConfigured } from "../db";
import { deliveryStatus, orders } from "../db/schema";
import { auth } from "../server/auth";
import { badRequest, dbUnavailable, getSessionUser, serverError, unauthorized } from "./lib/http";

const ORDER_STATUSES = ["pending", "paid", "refunded"] as const;
const METHODS = ["multicaixa", "paypay", "card", "wire_usd", "wire_eur"] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {    if (!isDbConfigured || !db) return dbUnavailable(res);

  try {
    const user = await getSessionUser(req, auth);
    if (!user) return unauthorized(res);

    if (req.method === "GET") {
      const rows = await db.select().from(orders).orderBy(desc(orders.created_at)).limit(200);
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const body = bodyOf(req);
      const clientName = str(body.client_name).trim() || "Walk-in";
      const amount = Number(body.amount);
      const method = str(body.method) || "multicaixa";
      const clientId = str(body.client_id).trim() || null;
      if (!Number.isFinite(amount) || amount <= 0) return badRequest(res, "amount must be a positive number.");
      if (!(METHODS as readonly string[]).includes(method)) {
        return badRequest(res, `method must be one of ${METHODS.join(", ")}.`);
      }
      const reference = `manual-${crypto.randomUUID()}`;
      const [row] = await db
        .insert(orders)
        .values({
          client_id: clientId,
          client_name: clientName,
          amount: amount.toFixed(2),
          method,
          status: "pending",
          reference,
        })
        .returning();
      // Mirror the Ops Manager behaviour: register the sold pack for delivery QA.
      await db.insert(deliveryStatus).values({
        client_id: clientId,
        order_id: row.id,
        client_name: clientName,
        pack: "manual",
        method,
        amount: amount.toFixed(2),
      });
      return res.status(201).json(row);
    }

    if (req.method === "PATCH") {
      const id = str(req.query.id);
      if (!id) return badRequest(res, "id query parameter is required.");
      const body = bodyOf(req) as { status?: unknown };
      const status = str(body.status);
      if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
        return badRequest(res, `status must be one of ${ORDER_STATUSES.join(", ")}.`);
      }
      const [row] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
      if (!row) return res.status(404).json({ error: "Order not found." });
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
