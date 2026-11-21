import { isAdminEmail } from "./admin";

export type AuthPolicyRequest = { url?: string; body?: unknown };
export type AuthPolicyDenial = { status: 400 | 403 | 503; message: string };

function bodyRecord(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

/** Shared allowlist for every authentication route adapter. */
export function getAdminAuthDenial(request: AuthPolicyRequest): AuthPolicyDenial | null {
  let path: string;
  try {
    path = new URL(request.url ?? "/", "http://localhost").pathname.toLowerCase().replace(/\/+$/, "");
  } catch {
    return { status: 400, message: "Invalid authentication route." };
  }

  const body = bodyRecord(request.body);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const newEmail = typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
  const isEmailSignIn = path.endsWith("/sign-in/email");
  const isEmailChange = path.endsWith("/change-email") || path.endsWith("/update-user");
  const usesAlternateIdentity =
    typeof body.provider === "string" || typeof body.username === "string" || typeof body.phoneNumber === "string";

  if (usesAlternateIdentity || (email && !isAdminEmail(email)) || (newEmail && !isAdminEmail(newEmail))) {
    return { status: 403, message: "This application is restricted to its authorized administrator." };
  }
  if (path.includes("/sign-up/")) {
    return { status: 403, message: "Account registration is disabled for this administrator-only application." };
  }
  if (
    path.endsWith("/forget-password") ||
    path.endsWith("/request-password-reset") ||
    path.endsWith("/reset-password") ||
    path.endsWith("/send-verification-email") ||
    path.endsWith("/resend-verification-email")
  ) {
    return { status: 503, message: "Email delivery is not configured for account recovery." };
  }
  if (path.includes("/sign-in/") && !isEmailSignIn) {
    return { status: 403, message: "Only email and password sign-in is permitted." };
  }
  if (isEmailSignIn && !isAdminEmail(email)) {
    return { status: 403, message: "This application is restricted to its authorized administrator." };
  }
  if (isEmailChange && ((email && !isAdminEmail(email)) || (newEmail && !isAdminEmail(newEmail)))) {
    return { status: 403, message: "The administrator email address cannot be changed here." };
  }
  return null;
}
