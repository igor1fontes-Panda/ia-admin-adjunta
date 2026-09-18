import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Header } from "./components/Header";
import { authClient } from "./lib/auth-client";
import { PreferencesProvider } from "./lib/i18n";
import "./theme.css";

const Landing = lazy(() => import("./pages/Landing").then((m) => ({ default: m.Landing })));
const Auth = lazy(() => import("./pages/Auth").then((m) => ({ default: m.Auth })));
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));

function PageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
    </div>
  );
}

export default function App() {
  return (
    <PreferencesProvider>
      <BrowserRouter>
        <AppFrame />
        <SpeedInsights />
        <Analytics />
      </BrowserRouter>
    </PreferencesProvider>
  );
}

function AppFrame() {
  const location = useLocation();
  const pageTone = location.pathname === "/dashboard" ? "page-dashboard" : location.pathname === "/auth" ? "page-auth" : "page-landing";

  return (
    <div className={`app-shell ${pageTone} flex min-h-screen flex-col`}>
      <div className="anime-skyline" aria-hidden="true" />
      <Header />
      <main className="relative z-10 flex-1">
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<DashboardGate />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

/**
 * Dashboard gate. When the serverless backend (Neon + auth) is not configured
 * we must show the setup checklist WITHOUT requiring sign-in — there are no
 * accounts to sign into yet, so gating this page behind auth would make the
 * checklist unreachable.
 */
function DashboardGate() {
  if (!import.meta.env.DEV && !import.meta.env.VITE_API_OK) {
    // The API is reachable (health is checked by the deploy-status workflow);
    // this gate only guards the local-dev cold state where no backend exists.
  }
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}

/**
 * Auth gate — real Better Auth sessions only (HttpOnly cookie based).
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
      </div>
    );
  }
  if (!session?.user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
