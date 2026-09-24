import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

export type Locale = "pt" | "en";
export type Theme = "light" | "dark";

type CopyKey =
  | "home"
  | "products"
  | "store"
  | "agents"
  | "services"
  | "support"
  | "dashboard"
  | "signOut"
  | "getStarted"
  | "commandCenter"
  | "refresh"
  | "live"
  | "connecting"
  | "offline"
  | "themeLight"
  | "themeDark"
  | "language";

const copy: Record<Locale, Record<CopyKey, string>> = {
  pt: {
    home: "Início",
    products: "Produtos",
    store: "Loja",
    agents: "Agentes IA",
    services: "Serviços",
    support: "Suporte",
    dashboard: "Dashboard",
    signOut: "Sair",
    getStarted: "Começar",
    commandCenter: "Abrir central",
    refresh: "Atualizar",
    live: "Ao vivo",
    connecting: "A ligar…",
    offline: "Offline",
    themeLight: "Tema claro",
    themeDark: "Tema noturno",
    language: "Idioma",
  },
  en: {
    home: "Home",
    products: "Products",
    store: "Store",
    agents: "AI agents",
    services: "Services",
    support: "Support",
    dashboard: "Dashboard",
    signOut: "Sign out",
    getStarted: "Get started",
    commandCenter: "Open command center",
    refresh: "Refresh",
    live: "Live",
    connecting: "Connecting…",
    offline: "Offline",
    themeLight: "Light theme",
    themeDark: "Dark theme",
    language: "Language",
  },
};

type Preferences = { locale: Locale; theme: Theme };
const defaults: Preferences = { locale: "pt", theme: "dark" };

const PreferencesContext = createContext<
  (Preferences & { setLocale: (locale: Locale) => void; toggleTheme: () => void; t: (key: CopyKey) => string }) | null
>(null);

function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem("fontes-preferences") ?? "null") as Partial<Preferences> | null;
    return {
      locale: stored?.locale === "en" ? "en" : defaults.locale,
      theme: stored?.theme === "light" ? "light" : defaults.theme,
    };
  } catch {
    return defaults;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  useEffect(() => setPreferences(readPreferences()), []);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.lang = preferences.locale === "pt" ? "pt-PT" : "en";
    localStorage.setItem("fontes-preferences", JSON.stringify(preferences));
  }, [preferences]);
  const value = useMemo(
    () => ({
      ...preferences,
      setLocale: (locale: Locale) => setPreferences((current) => ({ ...current, locale })),
      toggleTheme: () =>
        setPreferences((current) => ({ ...current, theme: current.theme === "dark" ? "light" : "dark" })),
      t: (key: CopyKey) => copy[preferences.locale][key],
    }),
    [preferences],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used within PreferencesProvider");
  return context;
}

/**
 * Idioma da interface — PT por defeito (Angola/Portugal), EN opcional.
 * Sem dependências externas: store global + useSyncExternalStore,
 * persistido em localStorage e sincronizado com <html lang>.
 */

export type Lang = "pt" | "en";

const STORAGE_KEY = "fontes-lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "pt" || saved === "en") return saved;
  } catch {
    /* SSR / storage bloqueado — usa o defeito */
  }
  return "pt";
}

let current: Lang = initialLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignora */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang === "pt" ? "pt" : "en";
  }
  for (const fn of listeners) fn();
}

export function toggleLang() {
  setLang(current === "pt" ? "en" : "pt");
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Assina o idioma atual (re-render quando muda). */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}
import { en } from "./en";
import { pt, type Dict } from "./pt";

const dict: Record<Lang, Dict> = { pt, en };

/** Resolve um caminho "a.b.c" no dicionário; devolve undefined se não existir. */
export function lookup(lang: Lang, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict[lang]);
}

/**
 * Hook de tradução: `const t = useT(); t("dash.title")`.
 * Faz fallback para PT se uma chave faltar no idioma ativo.
 */
export function useT() {
  const lang = useLang();
  return (path: string): string => {
    const value = lookup(lang, path) ?? lookup("pt", path);
    return typeof value === "string" ? value : path;
  };
}

/** Lista de strings (arrays no dicionário) com fallback para PT. */
export function useTList() {
  const lang = useLang();
  return (path: string): string[] => {
    const value = lookup(lang, path) ?? lookup("pt", path);
    return Array.isArray(value) ? (value as string[]) : [];
  };
}

/** Objeto aninhado do dicionário (ex.: tObj("dash.modules.leads") => [label, desc]). */
export function useTAny() {
  const lang = useLang();
  return (path: string): unknown => lookup(lang, path) ?? lookup("pt", path);
}
