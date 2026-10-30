"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { ArrowLeftRight, BadgeCheck, Store, Wallet } from "lucide-react";
import { useRef } from "react";
import { Item, Reveal, SectionTag } from "./motion";

const STEPS = [
  {
    icon: ArrowLeftRight,
    title: "Vous allouez",
    text: "Vous donnez un stock de tickets à chaque point de vente. OptiSpace l'enregistre : qui, quand, combien.",
  },
  {
    icon: Store,
    title: "Ils vendent",
    text: "Vos revendeurs vendent comme d'habitude. Le stock restant de chaque POS est connu à tout moment.",
  },
  {
    icon: Wallet,
    title: "Vous encaissez",
    text: "Le collecteur saisit les tickets vendus. L'outil calcule le montant attendu et le compare à l'argent remis.",
  },
  {
    icon: BadgeCheck,
    title: "Vous savez",
    text: "Écart signalé immédiatement, commission calculée, tableau de bord à jour. Plus de doute, plus de dispute.",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });

  return (
    <section id="fonctionnement" className="relative overflow-hidden bg-surface-low py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <SectionTag>Comment ça marche</SectionTag>
          <Item as="h2" className="mt-5 text-4xl font-extrabold tracking-[-0.03em] text-ink sm:text-5xl">
            Votre façon de travailler.{" "}
            <span className="text-brand-600">Enfin sous contrôle.</span>
          </Item>
          <Item as="p" className="mt-5 text-lg text-ink-soft">
            Vous ne changez rien à votre organisation. OptiSpace suit simplement le parcours de chaque ticket, en 4 temps.
          </Item>
        </Reveal>

        <div ref={ref} className="relative mt-16">
          {/* rail de progression (desktop horizontal, mobile vertical) */}
          <div className="absolute left-[27px] top-0 h-full w-[3px] rounded bg-line lg:left-[12.5%] lg:right-[12.5%] lg:top-[27px] lg:h-[3px] lg:w-auto">
            <Rail progress={scrollYProgress} />
          </div>

          <ol className="relative grid gap-10 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((s, i) => (
              <Step key={s.title} step={s} index={i} progress={scrollYProgress} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Rail({ progress }: { progress: MotionValue<number> }) {
  const scale = useTransform(progress, [0, 1], [0, 1]);
  return (
    <>
      <motion.div style={{ scaleX: scale, originX: 0 }} className="hidden h-full w-full rounded bg-gradient-to-r from-brand-500 to-brand-400 lg:block" />
      <motion.div style={{ scaleY: scale, originY: 0 }} className="h-full w-full rounded bg-gradient-to-b from-brand-500 to-brand-400 lg:hidden" />
    </>
  );
}

function Step({ step, index, progress }: { step: (typeof STEPS)[number]; index: number; progress: MotionValue<number> }) {
  const at = index / (STEPS.length - 1);
  const on = useTransform(progress, [Math.max(0, at - 0.08), at], [0, 1]);
  const bg = useTransform(on, [0, 1], ["#ffffff", "#3f9e63"]);
  const color = useTransform(on, [0, 1], ["#52665a", "#0b1a0f"]);
  const ring = useTransform(on, [0, 1], ["0 0 0 0px rgb(63 158 99 / 0)", "0 0 0 8px rgb(63 158 99 / 0.15)"]);
  const scale = useTransform(on, [0, 0.6, 1], [1, 1.12, 1]);
  const opacity = useTransform(on, [0, 1], [0.55, 1]);

  return (
    <li className="relative flex gap-5 lg:flex-col lg:items-center lg:text-center">
      <motion.span
        style={{ backgroundColor: bg, color, boxShadow: ring, scale }}
        className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl ring-1 ring-line"
      >
        <step.icon className="h-6 w-6" />
      </motion.span>
      <motion.div style={{ opacity }}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Étape {index + 1}</p>
        <h3 className="mt-1 text-xl font-bold tracking-tight text-ink">{step.title}</h3>
        <p className="mt-2 leading-relaxed text-ink-soft">{step.text}</p>
      </motion.div>
    </li>
  );
}
