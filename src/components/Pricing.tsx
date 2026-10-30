"use client";

import { motion } from "motion/react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { INCLUDED } from "@/lib/content";
import { useSite } from "./SiteProvider";
import { CountUp, Item, Reveal, SectionTag } from "./motion";

export function Pricing() {
  const { content, plans: PLANS } = useSite();
  const { pricing, links } = content;
  return (
    <section id="tarifs" className="relative bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <SectionTag>Tarifs</SectionTag>
          <Item as="h2" className="mt-5 text-4xl font-extrabold tracking-[-0.03em] text-ink sm:text-5xl">
            {pricing.title}
          </Item>
          <Item as="p" className="mt-5 text-lg text-ink-soft">
            {pricing.subtitle}
          </Item>
        </Reveal>

        <Reveal className={`mt-14 grid items-stretch gap-5 ${PLANS.length >= 3 ? "lg:grid-cols-3" : PLANS.length === 2 ? "lg:grid-cols-2 lg:px-24" : "mx-auto max-w-md"}`} gap={0.12}>
          {PLANS.map((p) => (
            <Item key={p.name}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className={`relative flex h-full flex-col rounded-3xl p-7 sm:p-8 ${
                  p.featured
                    ? "bg-brand-900 text-white ring-2 ring-brand-400 shadow-[0_30px_80px_-30px_rgb(63_158_99/0.7)]"
                    : "bg-white ring-1 ring-line card-elev"
                }`}
              >
                {p.featured && (
                  <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-brand-400 px-3.5 py-1 text-xs font-bold text-brand-on">
                    <Sparkles className="h-3.5 w-3.5" /> Recommandé
                  </span>
                )}
                <h3 className={`text-lg font-bold ${p.featured ? "text-brand-300" : "text-brand-700"}`}>{p.name}</h3>
                <p className={`mt-2 min-h-12 text-sm leading-relaxed ${p.featured ? "text-white/65" : "text-ink-soft"}`}>{p.pitch}</p>

                <div className="mt-6 flex items-baseline gap-2">
                  {p.price === 0 ? (
                    <span className="text-5xl font-extrabold tracking-tight">Gratuit</span>
                  ) : (
                    <>
                      <CountUp value={p.price} className="text-5xl font-extrabold tracking-tight" />
                      <span className={`text-sm font-semibold ${p.featured ? "text-white/60" : "text-ink-soft"}`}>FCFA</span>
                    </>
                  )}
                </div>
                <p className={`mt-1 text-sm ${p.featured ? "text-white/55" : "text-ink-soft"}`}>{p.period}</p>

                <ul className="mt-7 space-y-3 border-t border-current/10 pt-6">
                  {[...p.limits, ...p.extras].map((l) => (
                    <li key={l} className="flex items-start gap-2.5 text-[15px]">
                      <Check className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${p.featured ? "text-brand-400" : "text-brand-500"}`} />
                      {l}
                    </li>
                  ))}
                </ul>

                <a
                  href={links.signup_url} data-cta="signup" data-cta-location="pricing" data-cta-plan={p.name}
              target="_blank"
              rel="noopener noreferrer"
                  className={`group mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-2xl font-bold transition ${
                    p.featured
                      ? "bg-brand-400 text-brand-on hover:bg-brand-300"
                      : "bg-brand-50 text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100"
                  }`}
                >
                  {p.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
              </motion.div>
            </Item>
          ))}
        </Reveal>

        <Reveal className="mt-10 rounded-3xl bg-surface-low p-6 ring-1 ring-line sm:p-8">
          <Item as="p" className="text-center text-sm font-bold uppercase tracking-wider text-ink-soft">
            Inclus dans tous les forfaits
          </Item>
          <Item className="mt-5 flex flex-wrap justify-center gap-2">
            {INCLUDED.map((f) => (
              <span key={f} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-ink ring-1 ring-line">
                <Check className="h-3.5 w-3.5 text-brand-500" /> {f}
              </span>
            ))}
          </Item>
        </Reveal>
      </div>
    </section>
  );
}
