import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: "Stripe is not configured for live checkout." });
  }

  let body: { plan?: unknown; quantity?: unknown };
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: "Invalid request body." });
  }

  const plan = typeof body.plan === "string" ? body.plan : "";
  const priceId = PRICE_IDS[plan];
  const parsedQuantity = Number(body.quantity ?? 1);

  if (!priceId) return res.status(503).json({ error: "This product is not available for purchase yet." });
  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 10) {
    return res.status(400).json({ error: "Quantity must be an integer between 1 and 10." });
  }

  try {
    const origin = req.headers.origin || process.env.PUBLIC_SITE_URL;
    if (!origin) return res.status(400).json({ error: "Checkout origin is unavailable." });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: parsedQuantity }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      billing_address_collection: "auto",
      customer_creation: "always",
      metadata: { plan: String(plan) },
      integration_identifier: `ia-admin-${Math.random().toString(36).slice(2, 10)}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("[stripe] checkout session creation failed", error);
    return res.status(500).json({ error: "Unable to create checkout session." });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
