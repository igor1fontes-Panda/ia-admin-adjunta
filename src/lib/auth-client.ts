/** Neon Managed Better Auth is the only identity provider for this app. */
import { createAuthClient } from "@neon/auth";
import { BetterAuthReactAdapter } from "@neon/auth/react/adapters";
import { ADMIN_EMAIL, isAdminEmail } from "../../shared/admin";

export { ADMIN_EMAIL };

const configuredUrl = (import.meta.env.NEON_VITE_NEON_AUTH_URL || import.meta.env.VITE_NEON_AUTH_URL || "").trim();

export const authConfigured = configuredUrl.length > 0;

export const authClient = authConfigured
  ? createAuthClient(configuredUrl, { adapter: BetterAuthReactAdapter({ fetchOptions: { credentials: "include" } }) })
  : null;

function requireAuthClient() {
  if (!authClient) throw new Error("Neon Managed Auth não está configurado neste ambiente.");
  return authClient;
}

export async function signInAdmin(email: string, password: string) {
  if (!isAdminEmail(email)) {
    throw new Error("Esta identidade não está autorizada a aceder à administração.");
  }

  const client = requireAuthClient();
  const signInResult = await client.signIn.email({ email, password });
  if (signInResult.error) {
    throw new Error(signInResult.error.message || "Não foi possível iniciar sessão.");
  }

  const sessionResult = await client.getSession();
  if (sessionResult.error || !isAdminEmail(sessionResult.data?.user?.email)) {
    await client.signOut();
    throw new Error("A sessão autenticada não pertence ao administrador autorizado.");
  }

  return sessionResult.data;
}

export async function getSessionToken(): Promise<string | null> {
  const client = authClient;
  if (!client) return null;

  const result = await client.getSession();
  if (result.error) throw new Error(result.error.message || "Não foi possível validar a sessão.");
  if (!isAdminEmail(result.data?.user?.email)) return null;
  return result.data?.session?.token ?? null;
}

export async function signOutAdmin(): Promise<void> {
  const client = authClient;
  if (!client) return;

  const result = await client.signOut();
  if (result.error) throw new Error(result.error.message || "Não foi possível terminar a sessão.");
}
