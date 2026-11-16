"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  CheckCircle2,
  Eye,
  FileText,
  LayoutGrid,
  MapPin,
  Receipt,
  Store,
  Ticket,
} from "lucide-react";
import { useEffect, useState } from "react";
import { CountUp, EASE_OUT } from "./motion";

/**
 * Réplique codée du tableau de bord de l'outil, au design de la refonte HeroUI
 * (barre latérale claire, fond gris, cartes blanches), avec des données d'illustration.
 * Codée plutôt que capturée pour pouvoir l'animer.
 */

const KPIS = [
  { label: "Tickets vendus", value: 4812, suffix: "", sub: "38 encaissements", icon: Ticket, tint: "bg-amber-50 text-amber-600", eye: false },
  { label: "Chiffre d'affaires", value: 962400, suffix: " F", sub: "", icon: Receipt, tint: "bg-emerald-50 text-emerald-700", eye: true },
  { label: "Total encaissé", value: 948400, suffix: " F", sub: "", icon: CheckCircle2, tint: "bg-emerald-50 text-emerald-600", eye: true },
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
  { pos: "Boutique Riviera", who: "Koffi A.", amount: "86 000 F CFA", ok: true },
  { pos: "Cabine Angré", who: "Awa D.", amount: "41 500 F CFA", ok: false },
  { pos: "Kiosque Cocody", who: "Koffi A.", amount: "63 200 F CFA", ok: true },
];

const NAV = [LayoutGrid, Store, MapPin, ArrowLeftRight, Receipt, FileText];

/** Couleurs de la refonte HeroUI de l'outil (fond gris, cartes blanches, barre latérale claire). */
const APP_BG = "bg-[#f4f4f5]";
const CARD = "rounded-xl bg-white shadow-[0_1px_2px_rgb(0_0_0/0.05),0_2px_8px_-2px_rgb(0_0_0/0.06)]";

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
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 hidden rounded-md bg-white px-3 py-1 text-[11px] text-zinc-500 ring-1 ring-zinc-200 sm:block">
            optiwifi.site/dashboard
          </span>
        </div>

        <div className="flex">
          {/* barre latérale claire, élément actif sur fond gris */}
          <aside className="hidden w-14 shrink-0 flex-col items-center gap-1.5 border-r border-zinc-200 bg-white py-3 sm:flex">
            <Image src="/logo.jpg" alt="" width={30} height={30} className="mb-2 rounded-lg" />
            {NAV.map((Icon, i) => (
              <span
                key={i}
                className={`grid h-9 w-9 place-items-center rounded-lg ${i === 0 ? "bg-zinc-100 text-zinc-900" : "text-zinc-500"}`}
              >
                <Icon className="h-4 w-4" />
              </span>
            ))}
          </aside>

          <div className={`min-w-0 flex-1 ${APP_BG}`}>
            {/* en-tête de l'application */}
            <div className="flex items-center justify-between border-b border-zinc-200 bg-[#f4f4f5] px-3 py-2 sm:px-5">
              <p className="text-xs font-semibold text-zinc-900 sm:text-sm">Tableau de bord</p>
              <div className="flex items-center gap-2.5">
                <span className="relative grid h-7 w-7 place-items-center">
                  <Bell className="h-4 w-4 text-zinc-600" />
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={toast > 0 ? { scale: 1 } : { scale: 0 }}
                    className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#f4f4f5]"
                  />
                </span>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-800">CD</span>
                <span className="hidden leading-tight md:block">
                  <span className="block text-[10px] font-semibold text-zinc-900">Client Démo</span>
                  <span className="block text-[9px] text-zinc-500">Administrateur</span>
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-5">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-medium text-zinc-500">Depuis le début</p>
                  <p className="text-sm font-bold tracking-tight text-zinc-900 sm:text-lg">Tableau de bord</p>
                </div>
                <div className="hidden items-center gap-1 md:flex">
                  {["Tout", "Aujourd'hui", "7 jours", "Ce mois-ci"].map((p, i) => (
                    <span
                      key={p}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${i === 0 ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200"}`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* KPI */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {KPIS.map((k, i) => (
                  <motion.div
                    key={k.label}
                    initial={{ opacity: 0, y: 14 }}
                    animate={start ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.9 + i * 0.1, duration: 0.6, ease: EASE_OUT }}
                    className={`${CARD} p-2.5 sm:p-3`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="flex items-center gap-1 text-[9px] text-zinc-500 sm:text-[11px]">
                        {k.label}
                        {k.eye && <Eye className="hidden h-3 w-3 sm:block" />}
                      </p>
                      <span className={`grid h-5 w-5 place-items-center rounded-md sm:h-6 sm:w-6 ${k.tint}`}>
                        <k.icon className="h-3 w-3" />
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-zinc-900 sm:text-lg">
                      {start ? <CountUp value={k.value} suffix={k.suffix} delay={1 + i * 0.1} /> : "0"}
                    </p>
                    {k.sub && <p className="mt-0.5 hidden text-[9px] text-zinc-500 sm:block">{k.sub}</p>}
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={start ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 1.2, duration: 0.6, ease: EASE_OUT }}
                  className={`${CARD} p-2.5 ring-1 transition-colors duration-500 sm:p-3 ${toast >= 1 ? "ring-red-300" : "ring-transparent"}`}
                >
                  <div className="flex items-start justify-between">
                    <p className="flex items-center gap-1 text-[9px] text-zinc-500 sm:text-[11px]">
                      Écart <Eye className="hidden h-3 w-3 sm:block" />
                    </p>
                    <span className="grid h-5 w-5 place-items-center rounded-md bg-red-50 text-red-500 sm:h-6 sm:w-6">
                      <AlertTriangle className="h-3 w-3" />
                    </span>
                  </div>
                  <p className={`mt-1.5 text-sm font-bold sm:text-lg ${toast >= 1 ? "text-red-500" : "text-zinc-900"}`}>
                    {toast >= 1 ? <span className="num">-14 000 F</span> : <span className="num">0 F</span>}
                  </p>
                  <p className={`mt-0.5 hidden text-[9px] sm:block ${toast >= 1 ? "text-red-500" : "text-zinc-500"}`}>
                    {toast >= 1 ? "Manque à justifier" : "Aucun manque"}
                  </p>
                </motion.div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-5">
                {/* ventes par point de vente */}
                <div className={`${CARD} p-3 sm:col-span-3`}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-zinc-900">Ventes par point de vente</p>
                    <p className="text-[10px] text-zinc-500">7 POS</p>
                  </div>
                  <div className="flex h-24 items-end gap-1.5 sm:h-28 sm:gap-2">
                    {BARS.map((b, i) => (
                      <div key={b.pos} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                        <motion.div
                          initial={{ scaleY: 0 }}
                          animate={start ? { scaleY: 1 } : {}}
                          transition={{ delay: 1.3 + i * 0.07, duration: 0.9, ease: EASE_OUT }}
                          style={{ height: `${b.v * 100}%`, originY: 1 }}
                          className={`w-full rounded-t-md ${i === 1 && toast >= 1 ? "bg-gradient-to-b from-red-400 to-red-600" : "bg-gradient-to-b from-[#5cb85c] to-[#2f8a4b]"}`}
                        />
                        <span className="hidden text-[8px] text-zinc-500 sm:block">{b.pos}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 hidden items-center gap-3 text-[8px] text-zinc-500 sm:flex">
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#2f8a4b]" /> Ventes du point de vente</span>
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Avec un écart de caisse</span>
                  </div>
                </div>

                {/* derniers encaissements */}
                <div className={`${CARD} hidden p-3 sm:col-span-2 sm:block`}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-zinc-900">Derniers encaissements</p>
                    <p className="text-[10px] font-semibold text-emerald-700">Voir tout</p>
                  </div>
                  <ul className="space-y-1.5">
                    {ROWS.map((r, i) => (
                      <motion.li
                        key={r.pos}
                        initial={{ opacity: 0, x: 12 }}
                        animate={start ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 1.7 + i * 0.12, duration: 0.5, ease: EASE_OUT }}
                        className="flex items-center justify-between gap-2 rounded-lg bg-[#f4f4f5] px-2.5 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-semibold text-zinc-900">{r.pos}</p>
                          <p className="truncate text-[9px] text-zinc-500">
                            {r.who} · {r.amount}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                            r.ok ? "bg-emerald-50 text-emerald-700" : toast >= 1 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"
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
