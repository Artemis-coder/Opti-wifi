"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { BookOpen, HandCoins, Layers, PackageSearch } from "lucide-react";
import { useRef } from "react";
import { Item, Reveal, SectionTag } from "./motion";

const PAINS = [
  {
    icon: PackageSearch,
    quote: "Je donne 200 tickets le lundi. Le samedi, je ne sais plus combien ont vraiment été vendus.",
    tag: "Stock flou",
  },
  {
    icon: HandCoins,
    quote: "Le collecteur m'a remis moins que prévu… mais je n'ai aucun moyen de le prouver.",
    tag: "Écarts de caisse",
  },
  {
    icon: BookOpen,
    quote: "Mon cahier, mes messages WhatsApp et mon fichier Excel ne disent jamais la même chose.",
    tag: "Outils éparpillés",
  },
  {
    icon: Layers,
    quote: "J'ai ouvert un deuxième quartier. Depuis, j'ai perdu le contrôle du premier.",
    tag: "Croissance qui échappe",
  },
];

export function Pains() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 60%"] });
  const strike = useTransform(scrollYProgress, [0.05, 0.35], ["0%", "100%"]);

  return (
    <section id="probleme" className="relative bg-surface py-24 sm:py-32">
      <div ref={ref} className="mx-auto max-w-6xl px-5 sm:px-6">
        <Reveal className="mx-auto max-w-4xl text-center">
          <SectionTag>Ça vous parle ?</SectionTag>
          <Item as="h2" className="mt-5 text-4xl font-extrabold tracking-[-0.03em] text-ink sm:text-5xl">
            Gérer une zone Wi-Fi, c&apos;est simple.{" "}
            <span className="relative isolate inline-block text-danger">
              Jusqu&apos;au jour des comptes.
              <motion.span style={{ width: strike }} className="absolute bottom-0.5 left-0 -z-10 h-3 rounded bg-danger/15" />
            </span>
          </Item>
          <Item as="p" className="mt-5 text-lg leading-relaxed text-ink-soft">
            Vous avez des revendeurs, des collecteurs, des tickets dans plusieurs quartiers. Et chaque fin de semaine, la même
            question : <strong className="text-ink">où est passé l&apos;argent ?</strong>
          </Item>
        </Reveal>

        <Reveal className="mt-14 grid gap-4 sm:grid-cols-2" gap={0.12}>
          {PAINS.map((p) => (
            <Item key={p.tag}>
              <motion.figure
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="group h-full rounded-3xl bg-white p-7 ring-1 ring-line card-elev"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-danger transition-colors group-hover:bg-danger group-hover:text-white">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-surface-mid px-3 py-1 text-xs font-semibold text-ink-soft">{p.tag}</span>
                </div>
                <blockquote className="mt-6 text-xl font-semibold leading-snug tracking-tight text-ink">
                  « {p.quote} »
                </blockquote>
              </motion.figure>
            </Item>
          ))}
        </Reveal>

        <Reveal className="mt-14 text-center">
          <Item as="p" className="mx-auto max-w-2xl text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Chaque ticket qui n&apos;est pas suivi, c&apos;est de l&apos;argent qui part{" "}
            <span className="text-danger">sans faire de bruit.</span>
          </Item>
          <Item as="p" className="mt-3 text-ink-soft">
            Combien exactement ? Faites le calcul avec vos propres chiffres.
          </Item>
        </Reveal>
      </div>
    </section>
  );
}
