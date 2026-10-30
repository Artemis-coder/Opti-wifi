"use client";

import { motion } from "motion/react";
import { Building2, MapPinned, Store, X, Check } from "lucide-react";
import { Item, Reveal, SectionTag } from "./motion";

const PROFILES = [
  {
    icon: Store,
    who: "Vous démarrez",
    title: "1 à 3 points de vente",
    text: "Vous vendez vos tickets dans quelques boutiques du quartier et vous voulez des comptes propres dès le début.",
  },
  {
    icon: MapPinned,
    who: "Vous grandissez",
    title: "Plusieurs quartiers, des collecteurs",
    text: "Vous ne pouvez plus tout vérifier vous-même. Il vous faut une vue par zone et des encaissements sans contestation.",
  },
  {
    icon: Building2,
    who: "Vous êtes établi",
    title: "Un vrai réseau de distribution",
    text: "Des dizaines de revendeurs, une équipe, des associés. Vous avez besoin de rapports et d'un historique fiable.",
  },
];

const BEFORE = [
  "Un cahier et des messages pour suivre les stocks",
  "Des calculs à la main à chaque collecte",
  "Des écarts découverts trop tard, ou jamais",
  "Aucune vue claire de ce que rapporte chaque zone",
];

const AFTER = [
  "Le stock de chaque point de vente, à jour",
  "Le montant attendu calculé pour vous",
  "L'écart signalé au moment de l'encaissement",
  "Les chiffres de chaque zone, en temps réel",
];

export function Audience() {
  return (
    <section className="bg-surface-low py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <SectionTag>Pour qui</SectionTag>
          <Item as="h2" className="mt-5 text-4xl font-extrabold tracking-[-0.03em] text-ink sm:text-5xl">
            Si vous vendez des tickets Wi-Fi, <span className="text-brand-600">c&apos;est pour vous.</span>
          </Item>
        </Reveal>

        <Reveal className="mt-14 grid gap-4 md:grid-cols-3" gap={0.1}>
          {PROFILES.map((p, i) => (
            <Item key={p.who}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="relative h-full overflow-hidden rounded-3xl bg-white p-7 ring-1 ring-line card-elev"
              >
                <span className="absolute right-6 top-5 text-6xl font-black text-surface-mid">0{i + 1}</span>
                <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 text-brand-on">
                  <p.icon className="h-5 w-5" />
                </span>
                <p className="relative mt-6 text-sm font-bold uppercase tracking-wider text-brand-600">{p.who}</p>
                <h3 className="relative mt-1 text-xl font-bold text-ink">{p.title}</h3>
                <p className="relative mt-3 leading-relaxed text-ink-soft">{p.text}</p>
              </motion.div>
            </Item>
          ))}
        </Reveal>

        <Reveal className="mt-6 grid gap-4 md:grid-cols-2" gap={0.12}>
          <Item className="rounded-3xl bg-white p-7 ring-1 ring-line">
            <p className="text-sm font-bold uppercase tracking-wider text-ink-soft">Avant</p>
            <ul className="mt-5 space-y-3.5">
              {BEFORE.map((b) => (
                <li key={b} className="flex items-start gap-3 text-ink-soft">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-50 text-danger">
                    <X className="h-3 w-3" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </Item>
          <Item className="rounded-3xl bg-brand-900 p-7 text-white ring-1 ring-brand-800">
            <p className="text-sm font-bold uppercase tracking-wider text-brand-300">Avec OptiSpace</p>
            <ul className="mt-5 space-y-3.5">
              {AFTER.map((a) => (
                <li key={a} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-400 text-brand-on">
                    <Check className="h-3 w-3" />
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </Item>
        </Reveal>
      </div>
    </section>
  );
}
