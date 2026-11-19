/**
 * Stripe webhook — records paid orders in Neon Postgres (Drizzle).
 *
 * Paid checkouts create an order and register the pack for delivery QA.
 * The order row is locked while related records are written, making retries
 * idempotent and preventing partial writes when a transaction fails.
 */
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, isDbConfigured } from "../../db";
import { activityLog, deliveryStatus, orders } from "../../db/schema";

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured.");
  return new Stripe(key);
}

export const config = { api: { bodyParser: false } };

async function rawBody(req: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function getSignature(req: any): string | undefined {
  const value = req.headers["stripe-signature"];
  return Array.isArray(value) ? value[0] : value;
}

function isMinimalResource(value: unknown): value is { id: string; object?: string } {
  if (!value || typeof value !== "object") return false;
  const resource = value as { id?: unknown; object?: unknown };
  return (
    typeof resource.id === "string" &&
    (resource.object === undefined || typeof resource.object === "string")
  );
}

async function hydrateEventResource(
  event: Stripe.Event,
): Promise<Stripe.Event["data"]["object"]> {
  const resource = event.data.object;
  if (!isMinimalResource(resource)) return resource;

  if (event.type.startsWith("setup_intent.")) {
    return stripeClient().setupIntents.retrieve(resource.id);
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
    event = stripeClient().webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return res.status(400).json({ error: "Invalid Stripe webhook signature." });
  }

  if (event.type.startsWith("setup_intent.")) {
    await hydrateEventResource(event);
    return res.status(200).json({ received: true });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = (await hydrateEventResource(event)) as Stripe.Checkout.Session;
    if (
      session.payment_status !== "paid" &&
      event.type === "checkout.session.completed"
    ) {
      return res.status(200).json({ received: true });
    }

    const amount = ((session.amount_total || 0) / 100).toFixed(2);
    const customerName =
      session.customer_details?.name ||
      session.customer_details?.email ||
      "Stripe customer";
    const currency = session.currency?.toUpperCase() || "EUR";

    try {
      await db.transaction(async (tx) => {
        // Insert first so the unique reference constraint serializes concurrent
        // deliveries for this checkout session. A conflict means this order was
        // already created; the row lock below serializes its related writes.
        const [insertedOrder] = await tx
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
          .onConflictDoNothing({ target: orders.reference })
          .returning({ id: orders.id });

        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.reference, session.id))
          .for("update")
          .limit(1);
        if (!order) throw new Error("Stripe order could not be persisted.");

        const [existingDelivery] = await tx
          .select({ id: deliveryStatus.id })
          .from(deliveryStatus)
          .where(eq(deliveryStatus.order_id, order.id))
          .limit(1);
        if (!existingDelivery) {
          await tx.insert(deliveryStatus).values({
            client_id: null,
            order_id: order.id,
            client_name: customerName,
            pack: "stripe",
            method: "stripe",
            amount,
          });
        }

        if (insertedOrder) {
          await tx.insert(activityLog).values({
            kind: "sale",
            message: `Stripe: paid order ${order.reference} from ${customerName} (${amount} ${currency}).`,
          });
        }
      });
    } catch (error) {
      // A 5xx response asks Stripe to retry; the database transaction ensures
      // retries cannot leave duplicate or partially written records.
      console.error("[stripe] failed to persist checkout:", error);
      return res.status(500).json({ error: "Unable to record the completed checkout." });
    }
  }

  return res.status(200).json({ received: true });
}
