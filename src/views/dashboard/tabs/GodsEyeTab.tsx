/**
 * GodsEye Nano — Market radar.
 *
 * Ideia fundida de VrushankPatel/godseye (OSINT geoespacial: globo 3D, HUD
 * tático, camadas vivas de aviões/satélites/sismos/perigos), reinterpreta­da
 * para o mercado do AI Admin Adjunta: um radar de inteligência global em tempo
 * real, alimentado por APIs públicas sem chave — sem CesiumJS, zero
 * dependências novas.
 *
 * Camadas:
 *  - Voos comerciais (OpenSky Network — API pública sem chave)
 *  - Atividade sísmica 24h (USGS — API pública sem chave)
 *  - Perigos naturais ao vivo (NASA EONET — API pública sem chave)
 *  - Camada de negócio: leads/pedidos reais do próprio dashboard
 *
 * Tudo o que falha é mostrado como indisponível — nunca simulado (regra da app).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Crosshair, Globe2, Locate, Plane, RefreshCcw, Radio, Mountain, Waves } from "lucide-react";
import type { Lead, Order } from "../../../types";
import { formatKz, timeAgo } from "../../../lib/engine";
import { useT } from "../../../lib/i18n";

type FeedState<T> = { rows: T[]; at: string | null; error: string | null };

const IDLE: FeedState<never> = { rows: [], at: null, error: null };
const REFRESH_MS = 120_000; // 2 min — cortesia com as APIs públicas

function flightLabel(callsign: string | null, country: string | null): string {
  return `${(callsign ?? "—").trim() || "—"} · ${country ?? "?"}`;
}

export function GodsEyeTab({ leads, orders }: { leads: Lead[]; orders: Order[] }) {
  const t = useT();
  const [flights, setFlights] = useState<FeedState<{ icao: string; label: string; alt: number; vel: number }>>(IDLE);
  const [quakes, setQuakes] = useState<FeedState<{ id: string; place: string; mag: number; at: number }>>(IDLE);
  const [events, setEvents] = useState<FeedState<{ id: string; title: string; when: string | null }>>(IDLE);
  const busyRef = useRef(false);

  const pull = useCallback(async (signal?: AbortSignal) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const fetchJson = async (url: string): Promise<unknown> => {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };

    // OpenSky — tráfego aéreo global ao vivo (bounding box mundial)
    fetchJson("https://opensky-network.org/api/states/all")
      .then((raw) => {
        const states = (raw as { states?: unknown[][] } | null)?.states ?? [];
        const rows = states
          .filter((s) => Array.isArray(s) && s[1] && s[5] != null)
          .slice(0, 40)
          .map((s) => ({
            icao: String(s[0]),
            label: flightLabel(typeof s[1] === "string" ? s[1] : null, typeof s[2] === "string" ? s[2] : null),
            alt: Math.round(Number(s[7] ?? 0) || 0),
            vel: Math.round(Number(s[9] ?? 0) || 0),
          }));
        setFlights({ rows, at: new Date().toISOString(), error: null });
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name === "AbortError") return;
        setFlights({ rows: [], at: null, error: e instanceof Error ? e.message : "failed" });
      });

    // USGS — todos os sismos das últimas 24h (magnitude 2.5+)
    fetchJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson")
      .then((raw) => {
        const features = (raw as { features?: Array<{ id: string; properties: { place?: string; mag?: number; time?: number } }> }).features ?? [];
        const rows = features
          .slice(0, 30)
          .map((f) => ({ id: f.id, place: f.properties.place ?? "—", mag: f.properties.mag ?? 0, at: f.properties.time ?? 0 }));
        setQuakes({ rows, at: new Date().toISOString(), error: null });
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name === "AbortError") return;
        setQuakes({ rows: [], at: null, error: e instanceof Error ? e.message : "failed" });
      });

    // NASA EONET — eventos naturais abertos (tempestades, incêndios, vulcões)
    fetchJson("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=25")
      .then((raw) => {
        const evs = (raw as { events?: Array<{ id: string; title: string; geometry: Array<{ date?: string }> }> }).events ?? [];
        const rows = evs.map((e) => ({ id: e.id, title: e.title, when: e.geometry?.[0]?.date ?? null }));
        setEvents({ rows, at: new Date().toISOString(), error: null });
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name === "AbortError") return;
        setEvents({ rows: [], at: null, error: e instanceof Error ? e.message : "failed" });
      });

    busyRef.current = false;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    pull(controller.signal);
    const id = setInterval(() => pull(controller.signal), REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [pull]);

  // Radar de mercado: os nossos próprios dados vivos, à escala global de operação
  const market = useMemo(() => {
    const now = Date.now();
    const hot = leads.filter((l) => l.score >= 80).length;
    const fresh = leads.filter((l) => now - new Date(l.created_at).getTime() < 7 * 86_400_000).length;
    const pending = orders.filter((o) => o.status === "pending").reduce((s, o) => s + o.amount, 0);
    return { hot, fresh, pending };
  }, [leads, orders]);

  const feeds = [
    { key: "flights", icon: Plane, tone: "text-sky-400", state: flights },
    { key: "quakes", icon: Mountain, tone: "text-amber-400", state: quakes },
    { key: "events", icon: Waves, tone: "text-rose-400", state: events },
  ] as const;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-6">
      <div className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-transparent to-transparent px-6 py-5">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-zinc-50">
              <Globe2 size={20} className="text-cyan-300" /> {t("godsEye.title")}
              <span className="badge ml-1 bg-cyan-500/15 text-cyan-300">nano</span>
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">{t("godsEye.sub")}</p>
          </div>
          <button onClick={() => pull()} className="btn-ghost !px-4 !py-2 text-xs">
            <RefreshCcw size={14} /> {t("godsEye.refresh")}
          </button>
        </div>

        {/* Mercado próprio — a camada que nos distingue do OSINT puro */}
        <div className="grid grid-cols-2 gap-3 px-6 py-5 sm:grid-cols-3">
          {([
            [t("godsEye.market.hot"), market.hot, Crosshair, "text-gold-400"],
            [t("godsEye.market.fresh"), market.fresh, Locate, "text-emerald-400"],
            [t("godsEye.market.pending"), formatKz(market.pending), Radio, "text-sky-400"],
          ] as Array<[string, string | number, typeof Crosshair, string]>).map(([label, value, Icon, tone]) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-900/70 p-4">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 ${tone}`}>
                <Icon size={18} />
              </span>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
                <p className="text-lg font-bold text-zinc-50">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {feeds.map(({ key, icon: Icon, tone, state }) => (
          <div key={key} className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <h4 className={`flex items-center gap-2 font-semibold text-zinc-50`}>
                <Icon size={16} className={tone} /> {t(`godsEye.feeds.${key}`)}
              </h4>
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                {state.rows.length} {t("godsEye.live")}
              </span>
            </div>

            {state.error ? (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {t("godsEye.feedError")}
              </p>
            ) : state.rows.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-500">{t("godsEye.feedEmpty")}</p>
            ) : (
              <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1 text-xs">
                {state.rows.map((row) => {
                  if (key === "flights") {
                    const f = row as { icao: string; label: string; alt: number; vel: number };
                    return (
                      <li key={`${key}-${f.icao}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                        <span className="truncate font-medium text-zinc-200">{f.label}</span>
                        <span className="shrink-0 tabular-nums text-zinc-500">{Math.round(f.alt * 3.28).toLocaleString("en-US")} ft</span>
                      </li>
                    );
                  }
                  if (key === "quakes") {
                    const q = row as { id: string; place: string; mag: number; at: number };
                    return (
                      <li key={`${key}-${q.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                        <span className="truncate text-zinc-200">{q.place}</span>
                        <span className={`shrink-0 font-bold tabular-nums ${q.mag >= 5 ? "text-red-400" : q.mag >= 4 ? "text-amber-400" : "text-zinc-400"}`}>M{q.mag.toFixed(1)}</span>
                      </li>
                    );
                  }
                  const ev = row as { id: string; title: string; when: string | null };
                  return (
                    <li key={`${key}-${ev.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                      <span className="truncate text-zinc-200">{ev.title}</span>
                      <span className="shrink-0 text-zinc-500">{ev.when ? timeAgo(ev.when) : "—"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-[10px] text-zinc-600">
              {state.at ? `${t("godsEye.updated")} ${timeAgo(state.at)}` : t("godsEye.feedEmpty")}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-500">{t("godsEye.sources")}</p>
    </motion.div>
  );
}
