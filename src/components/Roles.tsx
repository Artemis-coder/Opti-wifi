"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { Check, ClipboardList, ShieldCheck, Store } from "lucide-react";
import { useState } from "react";
import { BrowserFrame } from "./Showcase";
import { EASE_OUT, Item, Reveal, SectionTag } from "./motion";
import { screen } from "@/lib/screens";

/**
 * « Chaque acteur a son espace » : gérant, collecteur, point de vente.
 * Vraies captures de l'outil (npm run capture : un compte de démonstration par rôle).
 */
const ROLES = [
  {
    id: "gerant",
    icon: ShieldCheck,
    tab: "Gérant",
    kicker: "Espace administrateur",
    title: "Vous pilotez tout le réseau",
    text: "Le tableau de bord rassemble vos ventes, l'argent encaissé et les écarts, sur la période de votre choix. Vous distribuez les tickets, suivez chaque point de vente et validez les corrections demandées par vos collecteurs.",
    points: [
      "Ventes par point de vente, écarts signalés en rouge",
      "Allocations, échanges et types de tickets",
      "Équipe, rapports et exports pour votre comptabilité",
    ],
    shot: screen("dashboard"),
    phone: screen("m-dashboard"),
    url: "optiwifi.site/dashboard",
  },
  {
    id: "collecteur",
    icon: ClipboardList,
    tab: "Collecteur",
    kicker: "Espace collecteur",
    title: "Sa tournée, dans sa poche",
    text: "Chaque collecteur se connecte avec son propre accès et ne voit que ses points de vente. OptiSpace lui indique ceux à visiter en priorité ; sur place, il encaisse et attribue des tickets en quelques touches.",
    points: [
      "Points de vente à visiter en priorité",
      "Nouvelle collecte et attribution de tickets sur place",
      "Écart à justifier et demandes de correction",
    ],
    shot: screen("collector-dashboard"),
    phone: screen("m-collector-dashboard"),
    url: "optiwifi.site/dashboard · collecteur",
  },
  {
    id: "point-de-vente",
    icon: Store,
    tab: "Point de vente",
    kicker: "Espace point de vente",
    title: "Vos revendeurs suivent leurs comptes",
    text: "Le point de vente se connecte avec son numéro de téléphone, en consultation seule. Il voit les tickets qu'il a reçus, l'argent collecté chez lui et sa commission : moins de questions, plus de confiance.",
    points: [
      "Tickets reçus et derniers mouvements",
      "Collectes, écarts et commission du mois",
      "Connexion par téléphone, sans rien pouvoir modifier",
    ],
    note: "Selon le forfait choisi.",
    shot: screen("pos-dashboard"),
    phone: screen("m-pos-dashboard"),
    url: "optiwifi.site/dashboard · point de vente",
  },
] as const;

export function Roles() {
  const [active, setActive] = useState(0);
  const role = ROLES[active];

  return (
    <section id="espaces" className="relative overflow-hidden bg-surface-low py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <SectionTag>Un espace pour chacun</SectionTag>
          <Item as="h2" className="mt-5 text-4xl font-extrabold tracking-[-0.03em] text-ink sm:text-5xl">
            Chaque acteur a son espace. <span className="text-brand-600">Chacun voit ce qui le concerne.</span>
          </Item>
          <Item as="p" className="mt-5 text-lg text-ink-soft">
            Le gérant pilote, le collecteur encaisse sur le terrain, le point de vente suit ses comptes. Mêmes chiffres pour tout le
            monde : fini les versions différentes de la même journée.
          </Item>
        </Reveal>

        <div role="tablist" aria-label="Espaces OptiSpace" className="mx-auto mt-12 flex w-fit flex-wrap justify-center gap-2 rounded-2xl bg-white p-1.5 ring-1 ring-line">
          {ROLES.map((r, i) => {
            const on = i === active;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(i)}
                className={`relative inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors sm:px-5 ${
                  on ? "text-brand-on" : "text-ink-soft hover:text-ink"
                }`}
              >
                {on && (
                  <motion.span
                    layoutId="role-pill"
                    className="absolute inset-0 rounded-xl bg-brand-500"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <r.icon className="relative h-4 w-4" />
                <span className="relative">{r.tab}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={role.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="mt-12 grid items-center gap-12 lg:grid-cols-[1fr_1.45fr]"
          >
            <div>
              <span className="inline-flex items-center gap-2 text-sm font-bold text-brand-600">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-100 text-brand-700">
                  <role.icon className="h-4.5 w-4.5" />
                </span>
                {role.kicker}
              </span>
              <h3 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">{role.title}</h3>
              <p className="mt-4 leading-relaxed text-ink-soft">{role.text}</p>
              <ul className="mt-6 space-y-2.5">
                {role.points.map((p, i) => (
                  <motion.li
                    key={p}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.08, duration: 0.4, ease: EASE_OUT }}
                    className="flex items-start gap-2.5 text-[15px] text-ink"
                  >
                    <Check className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-500" />
                    {p}
                  </motion.li>
                ))}
              </ul>
              {"note" in role && <p className="mt-5 text-sm text-ink-soft">{role.note}</p>}
            </div>

            <div className="relative pb-10 sm:pr-16">
              <BrowserFrame url={role.url}>
                <Image src={role.shot} alt={`OptiSpace — ${role.kicker}`} width={2880} height={1800} className="h-auto w-full" />
              </BrowserFrame>
              <motion.div
                initial={{ opacity: 0, y: 40, rotate: 4 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 22 }}
                className="absolute -bottom-2 right-0 w-[30%] min-w-[130px] max-w-[210px]"
              >
                <div className="rounded-[1.8rem] bg-[#0b130e] p-1.5 ring-1 ring-black/20 shot-shadow">
                  <div className="overflow-hidden rounded-[1.45rem] bg-white">
                    <Image src={role.phone} alt={`OptiSpace sur téléphone — ${role.kicker}`} width={780} height={1688} className="h-auto w-full" />
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
