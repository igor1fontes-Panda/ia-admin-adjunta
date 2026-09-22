/**
 * Additive Clerk bridge (session provider switch).
 *
 * Default stays the self-hosted Better Auth flow. When a Clerk publishable
 * key exists in the environment (pk_…), Clerk becomes the session provider:
 * - <SignIn />/<SignUp /> render in the auth view
 * - API calls authenticate with the Clerk session JWT (verified in
 *   api/lib/http.ts via @clerk/backend)
 *
 * With no key, everything falls back to Better Auth — zero regression.
 * Hook rule safety: each bridge component only calls hooks that live inside
 * its own always-present provider (Clerk hooks inside ClerkProvider,
 * Better Auth's query hook is provider-independent).
 */
import { ClerkProvider, SignIn, SignUp, useAuth, useUser } from "@clerk/react";
import { createContext, useContext, type ReactNode } from "react";
import { authClient } from "./auth-client";

export const CLERK_PK: string =
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined) ??
  "";

export const CLERK_ENABLED = CLERK_PK.startsWith("pk_");

export type BridgeSession = { email: string; name: string } | null;
export type BridgeAuth = { session: BridgeSession; isPending: boolean; signOut: () => Promise<void> };

const SessionCtx = createContext<BridgeAuth>({ session: null, isPending: true, signOut: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  if (CLERK_ENABLED) {
    return (
      <ClerkProvider publishableKey={CLERK_PK}>
        <ClerkBridge>{children}</ClerkBridge>
      </ClerkProvider>
    );
  }
  return <BetterAuthBridge>{children}</BetterAuthBridge>;
}

function ClerkBridge({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, signOut } = useAuth();
  const { user } = useUser();
  const value: BridgeAuth = {
    session:
      isSignedIn && user
        ? { email: user.primaryEmailAddress?.emailAddress ?? "", name: user.fullName ?? "" }
        : null,
    isPending: !isLoaded,
    signOut: async () => {
      await signOut();
      window.location.href = "/";
    },
  };
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

function BetterAuthBridge({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const value: BridgeAuth = {
    session: data?.user ? { email: data.user.email, name: data.user.name ?? "" } : null,
    isPending,
    signOut: async () => {
      await authClient.signOut();
    },
  };
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSessionBridge(): BridgeAuth {
  return useContext(SessionCtx);
}

export { SignIn as ClerkSignIn, SignUp as ClerkSignUp };

/** Session JWT for API calls (Clerk mode only; empty in Better Auth mode). */
export async function getClerkToken(): Promise<string> {
  if (!CLERK_ENABLED) return "";
  const clerk = (window as unknown as { Clerk?: { session?: { getToken(): Promise<string | null> } } }).Clerk;
  try {
    return (await clerk?.session?.getToken()) ?? "";
  } catch {
    return "";
  }
}
