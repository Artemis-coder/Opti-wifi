"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, PlayCircle, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { useRef } from "react";
import { useSite } from "./SiteProvider";
import { DashboardMock } from "./DashboardMock";
import { EASE_OUT } from "./motion";

const TRUST_ICONS = [ShieldCheck, Smartphone, Wallet, ShieldCheck];
const words = (s: string) => s.split(/\s+/).filter(Boolean);

const word = {
  hidden: { opacity: 0, y: "0.5em", filter: "blur(10px)" },
  show: { opacity: 1, y: "0em", filter: "blur(0px)", transition: { duration: 0.7, ease: EASE_OUT } },
};

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { content } = useSite();
  const { hero, links } = content;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const tilt = useTransform(scrollYProgress, [0, 0.5], [14, 0]);
  const lift = useTransform(scrollYProgress, [0, 0.5], [0, -40]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.94, 1]);
  const glowY = useTransform(scrollYProgress, [0, 1], [0, 200]);

  return (
    <section ref={ref} id="top" className="relative overflow-hidden bg-brand-950 pb-28 pt-32 text-white sm:pt-36">
      {/* fond : grille, halos, ondes Wi-Fi */}
      <div className="grid-fade pointer-events-none absolute inset-0" />
      <motion.div style={{ y: glowY }} className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10%] h-[640px] w-[900px] -translate-x-1/2 rounded-full bg-brand-500/25 blur-[120px]" />
        <div className="absolute right-[-10%] top-[40%] h-[420px] w-[420px] rounded-full bg-brand-400/15 blur-[100px]" />
      </motion.div>
      <WifiWaves />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-6">
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } } }} className="mx-auto max-w-6xl text-center">
          {hero.badge && (
          <motion.a
            href="#probleme"
            variants={word}
            className="group mb-7 inline-flex items-center gap-2 rounded-full bg-white/5 py-1.5 pl-4 pr-4 sm:pl-1.5 text-sm text-white/80 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <span className="hidden rounded-full bg-brand-400 px-2.5 py-0.5 text-xs font-bold text-brand-on sm:inline">Nouveau</span>
            {hero.badge}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </motion.a>
          )}

          <h1 className="text-[2.5rem] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:text-[4.4rem]">
            <span className="block">
              {words(hero.title_line1).map((w, i) => (
                <motion.span key={i} variants={word} className="mr-[0.22em] inline-block">
                  {w}
                </motion.span>
              ))}
            </span>
            <span className="block">
              {words(hero.title_line2).map((w, i) => (
                <motion.span key={i} variants={word} className="mr-[0.22em] inline-block pb-1 text-brand-400">
                  {w}
                </motion.span>
              ))}
            </span>
          </h1>

          <motion.p variants={word} className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
            {hero.subtitle}
          </motion.p>

          <motion.div variants={word} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={links.signup_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex h-14 items-center gap-2 overflow-hidden rounded-2xl bg-brand-400 px-7 text-base font-bold text-brand-on shadow-[0_10px_40px_-10px_rgb(132_200_101/0.7)] transition hover:bg-brand-300"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              {hero.cta_primary}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
            {content.sections.how_it_works && (
            <a
              href="#fonctionnement"
              className="inline-flex h-14 items-center gap-2 rounded-2xl px-6 text-base font-semibold text-white/85 ring-1 ring-white/15 transition hover:bg-white/5 hover:text-white"
            >
              <PlayCircle className="h-5 w-5" />
              {hero.cta_secondary}
            </a>
            )}
          </motion.div>

          <motion.ul variants={word} className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/55">
            {hero.trust.map((t, i) => {
              const Icon = TRUST_ICONS[i] ?? ShieldCheck;
              return (
                <li key={t} className="flex items-center gap-1.5"><Icon className="h-4 w-4 text-brand-400" /> {t}</li>
              );
            })}
          </motion.ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 1.1, ease: EASE_OUT }}
          className="relative mx-auto mt-14 max-w-5xl [perspective:1600px] sm:mt-16"
        >
          <motion.div style={{ rotateX: tilt, y: lift, scale }} className="origin-top">
            <DashboardMock />
          </motion.div>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-brand-950" />
    </section>
  );
}

/** Ondes Wi-Fi qui se propagent depuis le haut de la page, rappel du métier. */
function WifiWaves() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[-260px] -translate-x-1/2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 block h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-400/20"
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 1.1], opacity: [0, 0.8, 0] }}
          transition={{ duration: 7, repeat: Infinity, delay: i * 1.75, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
