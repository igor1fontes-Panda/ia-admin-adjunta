/**
 * Stripe webhook — records paid orders in Neon Postgres (Drizzle).
 *
 * Parity with POST /api/orders: a paid checkout creates the order (status
 * "paid") and registers the pack for delivery QA. Upsert on the unique
 * `reference` column makes webhook retries idempotent.
 */
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, isDbConfigured } from "../../db";
import { activityLog, deliveryStatus, orders } from "../../db/schema";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export const config = { api: { bodyParser: false } };

async function rawBody(req: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function getSignature(req: any): string | undefined {
  const value = req.headers["stripe-signature"];
  return Array.isArray(value) ? value[0] : value;
}

function isMinimalResource(value: unknown): value is { id: string; object?: string } {
  if (!value || typeof value !== "object") return false;
  const resource = value as { id?: unknown; object?: unknown };
  return typeof resource.id === "string" && (resource.object === undefined || typeof resource.object === "string");
}

async function hydrateEventResource(event: Stripe.Event): Promise<Stripe.Event["data"]["object"]> {
  const resource = event.data.object;
  if (!isMinimalResource(resource)) return resource;

  if (event.type.startsWith("setup_intent.")) {
    return stripe.setupIntents.retrieve(resource.id);
  }

  return resource;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Stripe webhook is not configured." });
  }
  if (!isDbConfigured || !db) {
    return res.status(503).json({ error: "Order database is not configured." });
  }

  let event: Stripe.Event;
  try {
    const payload = await rawBody(req);
    const signature = getSignature(req);
    if (!signature) throw new Error("Missing stripe-signature header.");
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return res.status(400).json({ error: "Invalid Stripe webhook signature." });
  }

  if (event.type.startsWith("setup_intent.")) {
    await hydrateEventResource(event);
    return res.status(200).json({ received: true });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = (await hydrateEventResource(event)) as Stripe.Checkout.Session;
    if (session.payment_status !== "paid" && event.type === "checkout.session.completed") {
      return res.status(200).json({ received: true });
    }

    const amount = ((session.amount_total || 0) / 100).toFixed(2);
    const customerName = session.customer_details?.name || session.customer_details?.email || "Stripe customer";
    const currency = session.currency?.toUpperCase() || "EUR";

    // Idempotent upsert — Stripe retries webhooks, the reference is unique.
    const [order] = await db
      .insert(orders)
      .values({
        client_id: null,
        client_name: customerName,
        amount,
        currency,
        method: "stripe",
        status: "paid",
        reference: session.id,
      })
      .onConflictDoUpdate({
        target: orders.reference,
        set: { status: "paid", amount },
      })
      .returning();

    // Mirror the Ops Manager behaviour: register the sold pack for delivery QA.
    await db.insert(deliveryStatus).values({
      client_id: null,
      order_id: order.id,
      client_name: customerName,
      pack: "stripe",
      method: "stripe",
      amount,
    });

    await db.insert(activityLog).values({
      kind: "sale",
      message: `Stripe: paid order ${order.reference} from ${customerName} (${amount} ${currency}).`,
    });
  }

  return res.status(200).json({ received: true });
}
