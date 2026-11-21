import { createContext, useContext, type ReactNode } from "react";
import { authClient, signOutAdmin } from "./auth-client";
import { isAdminEmail } from "../../shared/admin";

type SessionView = { id: string; email: string; name: string } | null;
type SessionContextValue = {
  session: SessionView;
  isPending: boolean;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue>({
  session: null,
  isPending: false,
  signOut: signOutAdmin,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  if (!authClient) {
    return (
      <SessionContext.Provider value={{ session: null, isPending: false, signOut: signOutAdmin }}>
        {children}
      </SessionContext.Provider>
    );
  }
  return <NeonSessionProvider client={authClient}>{children}</NeonSessionProvider>;
}

function NeonSessionProvider({ children, client }: { children: ReactNode; client: NonNullable<typeof authClient> }) {
  const { data, isPending } = client.useSession();
  const user = data?.user;
  const session: SessionView =
    user && isAdminEmail(user.email) ? { id: user.id, email: user.email, name: user.name || user.email } : null;

  return (
    <SessionContext.Provider value={{ session, isPending, signOut: signOutAdmin }}>{children}</SessionContext.Provider>
  );
}

export function useSessionBridge() {
  return useContext(SessionContext);
}
