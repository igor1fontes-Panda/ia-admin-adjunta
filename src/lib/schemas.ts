/**
 * Input validation schemas for the form/data boundaries (zod).
 *
 * Every FormData submission (public lead form, dashboard client/order
 * forms) is parsed through these schemas BEFORE it reaches the data layer,
 * so invalid payloads are rejected with a readable message instead of
 * producing a broken database row or a 500 from the API.
 */
import { z } from "zod";

/** Shared readable message for the first validation error of a schema. */
export function firstIssue(zodError: z.ZodError): string {
  const issue = zodError.issues[0];
  return issue ? issue.message : "Invalid input.";
}

// ---------- Public lead capture (landing page form) ----------

export const leadInputSchema = z.object({
  company: z.string().trim().min(2, "Company name must be at least 2 characters.").max(120),
  contact_name: z.string().trim().min(2, "Contact name must be at least 2 characters.").max(120),
  email: z.email("Enter a valid email address."),
  niche: z.string().trim().min(1, "Choose a niche.").max(80),
});
export type LeadInput = z.infer<typeof leadInputSchema>;

// ---------- Dashboard: new client ----------

export const clientInputSchema = z.object({
  name: z.string().trim().min(2, "Client name must be at least 2 characters.").max(120),
  email: z.email("Enter a valid billing email address."),
  plan: z.enum(["starter", "professional", "enterprise"], "Plan must be starter, professional or enterprise."),
});
export type ClientInput = z.infer<typeof clientInputSchema>;

// ---------- Dashboard: new order ----------

export const orderInputSchema = z.object({
  client_id: z.string().trim().min(1, "Select a client.").nullable(),
  client_name: z.string().trim().min(1, "Client name is required.").max(120),
  amount: z
    .number("Amount must be a number.")
    .int("Amount must be a whole number of AOA.")
    .min(1000, "Amount must be at least 1.000 Kz."),
  method: z.enum(["multicaixa", "paypay", "card", "wire_usd", "wire_eur"], "Choose a valid payment method."),
});
export type OrderInput = z.infer<typeof orderInputSchema>;

// ---------- FormData adapters (dashboard forms post FormData, not JSON) ----------

/** Parse a FormData into a validated ClientInput; throws a readable Error. */
export function parseClientForm(fd: FormData): ClientInput {
  const result = clientInputSchema.safeParse({
    name: String(fd.get("name") ?? ""),
    email: String(fd.get("email") ?? ""),
    plan: String(fd.get("plan") ?? "starter"),
  });
  if (!result.success) throw new Error(firstIssue(result.error));
  return result.data;
}

/** Parse a FormData into a validated OrderInput; throws a readable Error.
 * A walk-in order (empty client_id with no explicit name) defaults the
 * client_name to "Walk-in", mirroring the dashboard form behavior. */
export function parseOrderForm(fd: FormData): OrderInput {
  const amountRaw = String(fd.get("amount") ?? "").trim();
  const clientId = String(fd.get("client_id") ?? "").trim();
  const clientName = String(fd.get("client_name") ?? "").trim();
  const result = orderInputSchema.safeParse({
    client_id: clientId === "" ? null : clientId,
    client_name: clientName === "" && clientId === "" ? "Walk-in" : clientName,
    amount: amountRaw === "" ? Number.NaN : Number(amountRaw),
    method: String(fd.get("method") ?? ""),
  });
  if (!result.success) throw new Error(firstIssue(result.error));
  return result.data;
}
