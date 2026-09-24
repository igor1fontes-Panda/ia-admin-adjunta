export const setup = {
  title: "Database connection required",
  sub: "This app runs on real data only — no demo mode, no simulations.",
  alert: "The Neon Postgres database is not connected in this deployment, so authenticated data, persistence and autonomous delivery are paused. No fake leads, buyers or outreach are shown.",
  hint: "You can review the product-pack workflow from the public preview. Confirm `DATABASE_URL` and `BETTER_AUTH_SECRET` in Vercel and apply the Neon migration when you are ready to enable real storage, sessions and consent-gated outreach.",
};
