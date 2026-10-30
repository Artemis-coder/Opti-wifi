"use client";

import { motion } from "motion/react";
import { ArrowRight, Info } from "lucide-react";
import { useId, useRef, useState } from "react";
import { formatFcfa, planForPos } from "@/lib/content";
import { useSite } from "./SiteProvider";
import { track } from "@/lib/analytics";
import { AnimatedNumber, Item, Reveal, SectionTag } from "./motion";

type Field = { key: "pos" | "perDay" | "price" | "leak"; label: string; min: number; max: number; step: number; unit: string };

const FIELDS: Field[] = [
  { key: "pos", label: "Points de vente", min: 1, max: 30, step: 1, unit: "" },
  { key: "perDay", label: "Tickets vendus par jour et par POS", min: 5, max: 150, step: 5, unit: "" },
  { key: "price", label: "Prix moyen d'un ticket", min: 100, max: 2000, step: 50, unit: " F" },
  { key: "leak", label: "Part qui échappe au suivi (estimation)", min: 1, max: 20, step: 1, unit: " %" },
];

export function Calculator() {
  const { content, plans } = useSite();
  const [v, setV] = useState({ pos: 5, perDay: 30, price: 200, leak: 6 });
  const used = useRef(false);

  const monthly = v.pos * v.perDay * v.price * 30;
  const lost = monthly * (v.leak / 100);
  // Forfait adapté au nombre de points de vente (limites des forfaits du back-office).
  const plan = planForPos(plans, v.pos);
  const ratio = plan && plan.price > 0 ? lost / plan.price : 0;

  return (
    <section id="calculateur" className="bg-surface pb-24 sm:pb-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <Reveal className="overflow-hidden rounded-[2rem] bg-brand-900 text-white ring-1 ring-brand-800 lg:grid lg:grid-cols-[1.1fr_1fr]">
          <div className="p-7 sm:p-10">
            <SectionTag dark>Calculateur de fuites</SectionTag>
            <Item as="h2" className="mt-5 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
              Combien votre réseau perd-il sans que vous le voyiez ?
            </Item>
            <div className="mt-8 space-y-6">
              {FIELDS.map((f) => (
                <Slider key={f.key} field={f} value={v[f.key]} onChange={(n) => {
                    setV((s) => ({ ...s, [f.key]: n }));
                    if (!used.current) {
                      used.current = true;
                      track("calculator_used", { first_field: f.key });
                    }
                  }} />
              ))}
            </div>
            <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-white/50">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Estimation indicative sur 30 jours, à partir de vos réglages. Les fuites viennent des tickets non comptés, des
              erreurs de calcul et des écarts non détectés.
            </p>
          </div>

          <div className="relative flex flex-col justify-between gap-8 bg-gradient-to-br from-brand-800 to-brand-950 p-7 sm:p-10">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
            <div className="relative space-y-6">
              <div>
                <p className="text-sm font-medium text-white/60">Chiffre d&apos;affaires mensuel estimé</p>
                <p className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                  <AnimatedNumber value={monthly} suffix=" FCFA" />
                </p>
              </div>
              <div className="rounded-2xl bg-danger/15 p-5 ring-1 ring-danger/30">
                <p className="text-sm font-semibold text-red-200">Argent qui vous échappe chaque mois</p>
                <motion.p
                  key={Math.round(lost / 1000)}
                  initial={{ scale: 1.04 }}
                  animate={{ scale: 1 }}
                  className="mt-1 text-4xl font-extrabold tracking-tight text-white sm:text-5xl"
                >
                  <AnimatedNumber value={lost} suffix=" F" />
                </motion.p>
                <p className="mt-2 text-sm text-red-100/70">
                  soit <AnimatedNumber value={lost * 12} suffix=" FCFA" className="font-semibold text-white" /> par an.
                </p>
              </div>
              {plan && (
              <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <p className="text-sm text-white/60">
                  Forfait adapté à {v.pos} point{v.pos > 1 ? "s" : ""} de vente :{" "}
                  <strong className="text-white">{plan.name}</strong>
                  {plan.price > 0 ? ` à ${formatFcfa(plan.price)} / mois` : " (gratuit)"}
                </p>
                {ratio >= 1 && (
                  <p className="mt-2 text-lg font-bold text-brand-300">
                    Les fuites évitées représentent <AnimatedNumber value={ratio} suffix="×" /> le prix de l&apos;abonnement.
                  </p>
                )}
              </div>
              )}
            </div>
            <a
              href={content.links.signup_url} data-cta="signup" data-cta-location="calculator"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand-400 px-6 font-bold text-brand-on transition hover:bg-brand-300"
            >
              Arrêter les fuites dès aujourd&apos;hui
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Slider({ field, value, onChange }: { field: Field; value: number; onChange: (n: number) => void }) {
  const id = useId();
  const pct = ((value - field.min) / (field.max - field.min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-white/75">
          {field.label}
        </label>
        <span className="num rounded-lg bg-white/10 px-2.5 py-0.5 text-sm font-bold text-white">
          {new Intl.NumberFormat("fr-FR").format(value)}
          {field.unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={field.min}
        max={field.max}
        step={field.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ background: `linear-gradient(to right, var(--color-brand-400) ${pct}%, rgb(255 255 255 / 0.12) ${pct}%)` }}
        className="h-2 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgb(132_200_101/0.35)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
      />
    </div>
  );
}
