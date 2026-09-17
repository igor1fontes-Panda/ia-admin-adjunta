import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "pt" | "en";
export type Theme = "light" | "dark";

type CopyKey = "home" | "products" | "store" | "agents" | "services" | "support" | "dashboard" | "signOut" | "getStarted" | "commandCenter" | "refresh" | "live" | "connecting" | "offline" | "themeLight" | "themeDark" | "language";

const copy: Record<Locale, Record<CopyKey, string>> = {
  pt: { home: "Início", products: "Produtos", store: "Loja", agents: "Agentes IA", services: "Serviços", support: "Suporte", dashboard: "Dashboard", signOut: "Sair", getStarted: "Começar", commandCenter: "Abrir central", refresh: "Atualizar", live: "Ao vivo", connecting: "A ligar…", offline: "Offline", themeLight: "Tema claro", themeDark: "Tema noturno", language: "Idioma" },
  en: { home: "Home", products: "Products", store: "Store", agents: "AI agents", services: "Services", support: "Support", dashboard: "Dashboard", signOut: "Sign out", getStarted: "Get started", commandCenter: "Open command center", refresh: "Refresh", live: "Live", connecting: "Connecting…", offline: "Offline", themeLight: "Light theme", themeDark: "Dark theme", language: "Language" },
};

type Preferences = { locale: Locale; theme: Theme };
const defaults: Preferences = { locale: "pt", theme: "dark" };

const PreferencesContext = createContext<Preferences & { setLocale: (locale: Locale) => void; toggleTheme: () => void; t: (key: CopyKey) => string } | null>(null);

function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem("fontes-preferences") ?? "null") as Partial<Preferences> | null;
    return { locale: stored?.locale === "en" ? "en" : defaults.locale, theme: stored?.theme === "light" ? "light" : defaults.theme };
  } catch { return defaults; }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  useEffect(() => setPreferences(readPreferences()), []);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.lang = preferences.locale === "pt" ? "pt-PT" : "en";
    localStorage.setItem("fontes-preferences", JSON.stringify(preferences));
  }, [preferences]);
  const value = useMemo(() => ({ ...preferences, setLocale: (locale: Locale) => setPreferences((current) => ({ ...current, locale })), toggleTheme: () => setPreferences((current) => ({ ...current, theme: current.theme === "dark" ? "light" : "dark" })), t: (key: CopyKey) => copy[preferences.locale][key] }), [preferences]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used within PreferencesProvider");
  return context;
}
