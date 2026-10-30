"use client";

import Image from "next/image";
import { AnimatePresence, motion, useInView } from "motion/react";
import { Check, FileSpreadsheet, LayoutDashboard, PackagePlus, Receipt } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EASE_OUT, Item, Reveal, SectionTag } from "./motion";

const FEATURES = [
  {
    icon: LayoutDashboard,
    kicker: "Tableau de bord",
    title: "Toute votre activité en un coup d'œil",
    text: "Tickets vendus, chiffre d'affaires, total encaissé et écart : les 4 chiffres qui comptent, sur la période de votre choix, mis à jour à chaque encaissement.",
    points: ["Aujourd'hui, 7 jours, ce mois-ci ou depuis le début", "Ventes par point de vente, écarts signalés en rouge", "Derniers encaissements et raccourcis du quotidien"],
    shot: "/screens/dashboard.png",
    url: "optiwifi.site/dashboard",
  },
  {
    icon: Receipt,
    kicker: "Assistant d'encaissement",
    title: "Un encaissement juste, en 5 étapes guidées",
    text: "Choisissez le point de vente, saisissez les tickets vendus : OptiSpace calcule le montant attendu, la commission du collecteur, et compare avec l'argent réellement remis.",
    points: ["Impossible de déclarer plus que le stock", "Écart calculé automatiquement", "Validation finale tracée"],
    shot: "/screens/collection-new.png",
    url: "optiwifi.site/collections/new",
  },
  {
    icon: PackagePlus,
    kicker: "Allocations & échanges",
    title: "Chaque ticket a une adresse",
    text: "Distribuez vos stocks par point de vente et suivez alloué, vendu et restant. Un revendeur veut échanger des tickets invendus ? L'assistant d'échange vérifie que la valeur est équivalente.",
    points: ["Historique complet : qui a alloué, quand", "Échanges contrôlés en FCFA", "Remise à zéro sécurisée d'un POS"],
    shot: "/screens/allocations.png",
    url: "optiwifi.site/allocations",
  },
  {
    icon: FileSpreadsheet,
    kicker: "Rapports & exports",
    title: "Vos comptes prêts, sans recopier",
    text: "Filtrez par période et exportez vos encaissements et vos points de vente en CSV, prêts pour votre comptable ou votre associé.",
    points: ["Filtre par période", "Export des encaissements et des POS", "Attendu, encaissé, commission, écart"],
    shot: "/screens/reports.png",
    url: "optiwifi.site/reports",
  },
];

export function Showcase() {
  const [active, setActive] = useState(0);

  return (
    <section id="fonctionnalites" className="bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <SectionTag>L&apos;outil</SectionTag>
          <Item as="h2" className="mt-5 text-4xl font-extrabold tracking-[-0.03em] text-ink sm:text-5xl">
            Conçu pour votre métier, <span className="text-brand-600">pas pour un autre.</span>
          </Item>
          <Item as="p" className="mt-5 text-lg text-ink-soft">
            Pas un logiciel de caisse générique : chaque écran parle de tickets, de points de vente, de collecteurs et de FCFA.
            Voici les vrais écrans d&apos;OptiSpace.
          </Item>
        </Reveal>

        <div className="mt-16 lg:grid lg:grid-cols-[1fr_1.35fr] lg:gap-14">
          <div className="space-y-6 lg:space-y-0">
            {FEATURES.map((f, i) => (
              <FeatureBlock key={f.kicker} feature={f} index={i} active={active === i} onActive={setActive} />
            ))}
          </div>

          {/* écran collant (desktop) */}
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <BrowserFrame url={FEATURES[active].url}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.6, ease: EASE_OUT }}
                  >
                    <Image
                      src={FEATURES[active].shot}
                      alt={`Écran OptiSpace : ${FEATURES[active].kicker}`}
                      width={2880}
                      height={1800}
                      className="h-auto w-full"
                      priority={active === 0}
                    />
                  </motion.div>
                </AnimatePresence>
              </BrowserFrame>
              <div className="mt-5 flex justify-center gap-2">
                {FEATURES.map((f, i) => (
                  <span
                    key={f.kicker}
                    className={`h-1.5 rounded-full transition-all duration-500 ${i === active ? "w-8 bg-brand-500" : "w-1.5 bg-line"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureBlock({
  feature,
  index,
  active,
  onActive,
}: {
  feature: (typeof FEATURES)[number];
  index: number;
  active: boolean;
  onActive: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onActive(index);
  }, [inView, index, onActive]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
      className="lg:flex lg:min-h-[78vh] lg:items-center"
    >
      <div
        className={`rounded-3xl p-6 transition-all duration-500 sm:p-8 ${
          active ? "bg-white ring-1 ring-line card-elev" : "lg:opacity-45"
        } max-lg:bg-white max-lg:ring-1 max-lg:ring-line`}
      >
        <span className="inline-flex items-center gap-2 text-sm font-bold text-brand-600">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-100 text-brand-700">
            <feature.icon className="h-4.5 w-4.5" />
          </span>
          {feature.kicker}
        </span>
        <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{feature.title}</h3>
        <p className="mt-3 leading-relaxed text-ink-soft">{feature.text}</p>
        <ul className="mt-5 space-y-2">
          {feature.points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-[15px] text-ink">
              <Check className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-500" />
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-6 lg:hidden">
          <BrowserFrame url={feature.url}>
            <Image src={feature.shot} alt={`Écran OptiSpace : ${feature.kicker}`} width={2880} height={1800} className="h-auto w-full" />
          </BrowserFrame>
        </div>
      </div>
    </motion.div>
  );
}

export function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shot-shadow">
      <div className="flex items-center gap-2 border-b border-line bg-surface-low px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 truncate rounded-md bg-white px-3 py-1 text-[11px] text-ink-soft ring-1 ring-line">{url}</span>
      </div>
      <div className="relative overflow-hidden">{children}</div>
    </div>
  );
}
