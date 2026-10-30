"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useSite } from "./SiteProvider";
import { track } from "@/lib/analytics";
import { EASE_OUT, Item, Reveal, SectionTag } from "./motion";

export function Faq() {
  const FAQ = useSite().content.faq.items;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-surface-low py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
        <Reveal>
          <SectionTag>Questions fréquentes</SectionTag>
          <Item as="h2" className="mt-5 text-4xl font-extrabold tracking-[-0.03em] text-ink">
            Vous vous demandez sûrement…
          </Item>
          <Item as="p" className="mt-4 text-lg text-ink-soft">
            Les réponses aux questions que nous posent le plus souvent les gérants de zones Wi-Fi.
          </Item>
        </Reveal>

        <Reveal as="ul" className="space-y-3" gap={0.06}>
          {FAQ.map((f, i) => {
            const isOpen = open === i;
            return (
              <Item as="li" key={f.q}>
                <div className={`rounded-2xl bg-white ring-1 transition-colors ${isOpen ? "ring-brand-300" : "ring-line"}`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isOpen) track("faq_opened", { question: f.q.slice(0, 120), position: i + 1 });
                      setOpen(isOpen ? null : i);
                    }}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
                  >
                    <span className="text-base font-bold text-ink sm:text-lg">{f.q}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${isOpen ? "bg-brand-500 text-brand-on" : "bg-surface-mid text-ink"}`}
                    >
                      <Plus className="h-4 w-4" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: EASE_OUT }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-6 leading-relaxed text-ink-soft sm:px-6">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Item>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
