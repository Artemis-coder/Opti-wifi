"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  CheckCircle2,
  LayoutGrid,
  MapPin,
  Receipt,
  Store,
  Ticket,
} from "lucide-react";
import { useEffect, useState } from "react";
import { CountUp, EASE_OUT } from "./motion";

/**
 * Réplique codée du tableau de bord de l'outil (mêmes couleurs, mêmes cartes KPI
 * à liseré coloré, même chrome vert foncé) avec des données d'illustration.
 * Codée plutôt que capturée pour pouvoir l'animer.
 */

const KPIS = [
  { label: "Tickets vendus", value: 4812, suffix: "", icon: Ticket, tint: "bg-amber-50 text-amber-600" },
  { label: "Chiffre d'affaires", value: 962400, suffix: " F", icon: Receipt, tint: "bg-slate-100 text-blue-900" },
  { label: "Total encaissé", value: 948400, suffix: " F", icon: CheckCircle2, tint: "bg-emerald-50 text-emerald-600" },
];

const BARS = [
  { pos: "Riviera", v: 0.92 },
  { pos: "Angré", v: 0.64 },
  { pos: "Cocody", v: 0.78 },
  { pos: "Yopougon", v: 0.55 },
  { pos: "Marcory", v: 0.86 },
  { pos: "Plateau", v: 0.41 },
  { pos: "Abobo", v: 0.7 },
];

const ROWS = [
  { pos: "Boutique Riviera", who: "Koffi A.", amount: "86 000 F", ok: true },
  { pos: "Cabine Angré", who: "Awa D.", amount: "41 500 F", ok: false },
  { pos: "Kiosque Cocody", who: "Koffi A.", amount: "63 200 F", ok: true },
];

const NAV = [LayoutGrid, Store, MapPin, ArrowLeftRight, Receipt];

export function DashboardMock({ start = true }: { start?: boolean }) {
  const [toast, setToast] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    if (!start) return;
    const timers = [
      setTimeout(() => setToast(1), 2600),
      setTimeout(() => setToast(2), 6200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [start]);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 shot-shadow">
        {/* barre de fenêtre */}
        <div className="flex items-center gap-2 border-b border-line bg-surface-low px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 hidden rounded-md bg-white px-3 py-1 text-[11px] text-ink-soft ring-1 ring-line sm:block">
            optiwifi.site/dashboard
          </span>
        </div>

        <div className="flex">
          {/* sidebar */}
          <aside className="hidden w-14 shrink-0 flex-col items-center gap-2 bg-brand-900 py-4 sm:flex">
            <div className="mb-2 grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-[10px] font-black text-brand-on">OS</div>
            {NAV.map((Icon, i) => (
              <span
                key={i}
                className={`grid h-9 w-9 place-items-center rounded-lg ${i === 0 ? "bg-brand-500 text-brand-on" : "text-white/55"}`}
              >
                <Icon className="h-4 w-4" />
              </span>
            ))}
          </aside>

          <div className="min-w-0 flex-1 bg-[#f7faf8] p-3 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Depuis le début</p>
                <p className="text-sm font-bold text-ink sm:text-base">Tableau de bord</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-1 md:flex">
                  {["Tout", "Aujourd'hui", "7 jours", "Ce mois-ci"].map((p, i) => (
                    <span
                      key={p}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${i === 0 ? "bg-ink text-white" : "bg-white text-ink-soft ring-1 ring-line"}`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
                <span className="relative grid h-7 w-7 place-items-center rounded-full bg-white ring-1 ring-line">
                  <Bell className="h-3.5 w-3.5 text-ink-soft" />
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={toast > 0 ? { scale: 1 } : { scale: 0 }}
                    className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-white"
                  />
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-ink-soft ring-1 ring-line">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" /> En ligne
                </span>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {KPIS.map((k, i) => (
                <motion.div
                  key={k.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={start ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.9 + i * 0.1, duration: 0.6, ease: EASE_OUT }}
                  className={`rounded-xl bg-white p-2.5 ring-1 ring-line sm:p-3 ${i === 2 ? "hidden sm:block" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-soft sm:text-[10px]">{k.label}</p>
                    <span className={`grid h-5 w-5 place-items-center rounded-md ${k.tint}`}>
                      <k.icon className="h-3 w-3" />
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-extrabold text-ink sm:text-lg">
                    {start ? <CountUp value={k.value} suffix={k.suffix} delay={1 + i * 0.1} /> : "0"}
                  </p>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={start ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 1.2, duration: 0.6, ease: EASE_OUT }}
                className={`rounded-xl bg-white p-2.5 ring-1 sm:p-3 transition-colors duration-500 ${
                  toast >= 1 ? "ring-danger/40" : "ring-line"
                }`}
              >
                <div className="flex items-start justify-between">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-soft sm:text-[10px]">Écart</p>
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-red-50 text-danger">
                    <AlertTriangle className="h-3 w-3" />
                  </span>
                </div>
                <p className={`mt-1.5 text-sm font-extrabold sm:text-lg ${toast >= 1 ? "text-danger" : "text-brand-600"}`}>
                  {toast >= 1 ? <span className="num">-14 000 F</span> : <span className="num">0 F</span>}
                </p>
              </motion.div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-5">
              {/* ventes par POS */}
              <div className="rounded-xl bg-white p-3 ring-1 ring-line sm:col-span-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-ink">Ventes par point de vente</p>
                  <p className="text-[10px] text-ink-soft">7 POS</p>
                </div>
                <div className="flex h-24 items-end gap-1.5 sm:h-28 sm:gap-2">
                  {BARS.map((b, i) => (
                    <div key={b.pos} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={start ? { scaleY: 1 } : {}}
                        transition={{ delay: 1.3 + i * 0.07, duration: 0.9, ease: EASE_OUT }}
                        style={{ height: `${b.v * 100}%`, originY: 1 }}
                        className={`w-full rounded-t-md ${i === 1 && toast >= 1 ? "bg-danger/80" : "bg-gradient-to-t from-brand-600 to-brand-400"}`}
                      />
                      <span className="hidden text-[8px] text-ink-soft sm:block">{b.pos}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* derniers encaissements */}
              <div className="hidden rounded-xl bg-white p-3 ring-1 ring-line sm:col-span-2 sm:block">
                <p className="mb-2 text-[11px] font-bold text-ink">Derniers encaissements</p>
                <ul className="space-y-1.5">
                  {ROWS.map((r, i) => (
                    <motion.li
                      key={r.pos}
                      initial={{ opacity: 0, x: 12 }}
                      animate={start ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 1.7 + i * 0.12, duration: 0.5, ease: EASE_OUT }}
                      className="flex items-center justify-between rounded-lg bg-surface-low px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-semibold text-ink">{r.pos}</p>
                        <p className="text-[9px] text-ink-soft">{r.who}</p>
                      </div>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          r.ok ? "bg-brand-100 text-brand-700" : toast >= 1 ? "bg-red-50 text-danger" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {r.ok ? "Validée" : toast >= 1 ? "Écart" : "En cours"}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* notifications flottantes */}
      <div className="pointer-events-none absolute -bottom-6 left-3 right-3 flex justify-start sm:-left-8 sm:bottom-10 sm:right-auto">
        <AnimatePresence mode="popLayout">
          {toast === 1 && (
            <Toast
              key="gap"
              tone="danger"
              title="Écart détecté · Cabine Angré"
              body="14 000 F manquent sur l'encaissement d'Awa D."
            />
          )}
          {toast === 2 && (
            <Toast
              key="ok"
              tone="ok"
              title="Encaissement validé · Riviera"
              body="86 000 F reçus de Koffi A. · 0 F d'écart"
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Toast({ tone, title, body }: { tone: "danger" | "ok"; title: string; body: string }) {
  const danger = tone === "danger";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96, transition: { duration: 0.25 } }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="flex max-w-xs items-start gap-3 rounded-2xl bg-white/95 p-3 pr-4 ring-1 ring-black/5 backdrop-blur shot-shadow"
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          danger ? "bg-red-50 text-danger" : "bg-brand-100 text-brand-600"
        }`}
      >
        {danger ? <AlertTriangle className="h-4.5 w-4.5" /> : <CheckCircle2 className="h-4.5 w-4.5" />}
      </span>
      <div>
        <p className="text-[13px] font-bold leading-tight text-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-ink-soft">{body}</p>
      </div>
    </motion.div>
  );
}
