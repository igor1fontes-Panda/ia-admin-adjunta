import Stripe from "stripe";
import { createServerSupabaseClient } from "../lib/supabase-server";

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

  let event: Stripe.Event;
  try {
    const payload = await rawBody(req);
    event = stripe.webhooks.constructEvent(payload, getSignature(req), process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: "Invalid Stripe webhook signature." });
  }

  if (event.type.startsWith("setup_intent.")) {
    await hydrateEventResource(event);
    return res.status(200).json({ received: true });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = await hydrateEventResource(event) as Stripe.Checkout.Session;
    if (session.payment_status !== "paid" && event.type === "checkout.session.completed") {
      return res.status(200).json({ received: true });
    }

    let admin;
    try {
      admin = createServerSupabaseClient();
    } catch {
      return res.status(503).json({ error: "Order database is not configured." });
    }
    const amount = (session.amount_total || 0) / 100;
    const customerName = session.customer_details?.name || session.customer_details?.email || "Stripe customer";
    const { error } = await admin.from("orders").upsert(
      {
        client_name: customerName,
        amount,
        currency: session.currency?.toUpperCase() || "EUR",
        method: "stripe",
        status: "paid",
        reference: session.id,
      },
      { onConflict: "reference" },
    );
    if (error) return res.status(500).json({ error: "Unable to record paid order." });
  }

  return res.status(200).json({ received: true });
}
