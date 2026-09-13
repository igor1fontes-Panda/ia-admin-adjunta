import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Header } from "./components/Header";
import { Landing } from "./pages/Landing";
import { SetupRequired } from "./components/SetupRequired";
import { isLive, supabase } from "./lib/data";

// Code-split the two heavy, non-landing routes so the public landing page
// downloads a minimal bundle. The dashboard (recharts analytics) and the
// auth page load on demand — a permanent hot-spot fix for load performance.
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Auth = lazy(() => import("./pages/Auth").then((m) => ({ default: m.Auth })));

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<DashboardGate />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}

/**
 * Dashboard gate. When the database is not connected we must show the setup
 * checklist WITHOUT requiring sign-in — there are no accounts to sign into
 * yet, so gating this page behind auth would make the checklist unreachable.
 */
function DashboardGate() {
  if (!isLive) return <SetupRequired />;
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}

/**
 * Auth gate — real Supabase sessions only.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [session, setSession] = useState<"checking" | "yes" | "no">("checking");

  useEffect(() => {
    let mounted = true;

    if (isLive && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (mounted) setSession(data.session ? "yes" : "no");
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
        setSession(s ? "yes" : "no");
      });
      return () => {
        mounted = false;
        sub.subscription.unsubscribe();
      };
    }

    setSession("no");
    return () => {
      mounted = false;
    };
  }, []);

  if (session === "checking") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
      </div>
    );
  }
  if (session === "no") {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
