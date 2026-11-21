import { createContext, useContext, type ReactNode } from "react";
import { authClient } from "./auth-client";

export type BridgeSession = { email: string; name: string } | null;
export type BridgeAuth = {
  session: BridgeSession;
  isPending: boolean;
  signOut: () => Promise<void>;
};

const SessionCtx = createContext<BridgeAuth>({
  session: null,
  isPending: true,
  signOut: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
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
