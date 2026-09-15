import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export const config = { api: { bodyParser: false } };

async function rawBody(req: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Stripe webhook is not configured." });
  }

  let event: Stripe.Event;
  try {
    const payload = await rawBody(req);
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: "Invalid Stripe webhook signature." });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid" && event.type === "checkout.session.completed") {
      return res.status(200).json({ received: true });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) return res.status(503).json({ error: "Order database is not configured." });

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
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
