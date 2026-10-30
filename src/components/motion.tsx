"use client";

import { animate, motion, useInView, type Variants } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Courbe « emphasized decelerate » de Material 3, partagée par toute la page. */
export const EASE = [0.2, 0, 0, 1] as const;
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: EASE_OUT } },
};

export const stagger = (gap = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/** Conteneur qui déclenche ses enfants (variants `fadeUp`) quand il entre à l'écran. */
export function Reveal({
  children,
  className,
  gap = 0.08,
  delay = 0,
  as = "div",
  amount = 0.12,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  as?: "div" | "section" | "ul" | "ol";
  amount?: number;
}) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      variants={stagger(gap, delay)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </Comp>
  );
}

export function Item({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" | "p" | "h2" | "h3" | "span" }) {
  const Comp = motion[as];
  return (
    <Comp className={className} variants={fadeUp}>
      {children}
    </Comp>
  );
}

const fr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** Compteur animé qui démarre quand il devient visible. */
export function CountUp({
  value,
  suffix = "",
  duration = 1.6,
  delay = 0,
  className,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration,
      delay,
      ease: EASE_OUT,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, duration, delay]);

  return (
    <span ref={ref} className={`num ${className ?? ""}`}>
      {fr.format(Math.round(display))}
      {suffix}
    </span>
  );
}

/** Suit une valeur qui change (calculateur) avec une transition douce. */
export function AnimatedNumber({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const controls = animate(from.current, value, {
      duration: 0.6,
      ease: EASE_OUT,
      onUpdate: (v) => {
        from.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [value]);

  return (
    <span className={`num ${className ?? ""}`}>
      {fr.format(Math.round(display))}
      {suffix}
    </span>
  );
}

export function SectionTag({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <motion.span
      variants={fadeUp}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
        dark ? "bg-brand-400/10 text-brand-300 ring-1 ring-brand-400/25" : "bg-brand-100 text-brand-800"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dark ? "bg-brand-400" : "bg-brand-500"}`} />
      {children}
    </motion.span>
  );
}
