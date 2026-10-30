"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useSite } from "./SiteProvider";
import { Item, Reveal } from "./motion";

const TICKER = [
  "Tickets alloués",
  "Tickets vendus",
  "Montant attendu",
  "Encaissement validé",
  "Commission calculée",
  "Écart détecté",
  "Espace Wi-Fi",
  "Export CSV",
  "Mode hors-ligne",
  "Paiement Wave",
];

export function FinalCta() {
  const { final_cta: cta, links } = useSite().content;
  return (
    <section className="relative overflow-hidden bg-brand-950 pt-24 text-white sm:pt-32">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/25 blur-[140px]" />

      <Reveal className="relative mx-auto max-w-3xl px-5 text-center sm:px-6">
        <Item>
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto mb-8 w-fit"
          >
            <Image src="/logo.jpg" alt="" width={84} height={84} className="rounded-3xl ring-1 ring-brand-400/40 shadow-[0_20px_60px_-10px_rgb(132_200_101/0.5)]" />
          </motion.div>
        </Item>
        <Item as="h2" className="text-4xl font-extrabold tracking-[-0.035em] sm:text-6xl">
          {cta.title} {cta.highlight && <span className="text-gradient">{cta.highlight}</span>}
        </Item>
        <Item as="p" className="mx-auto mt-6 max-w-xl text-lg text-white/65">
          {cta.text}
        </Item>
        <Item className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={links.signup_url}
              target="_blank"
              rel="noopener noreferrer"
            className="group relative inline-flex h-14 items-center gap-2 overflow-hidden rounded-2xl bg-brand-400 px-8 text-base font-bold text-brand-on shadow-[0_10px_40px_-10px_rgb(132_200_101/0.7)] transition hover:bg-brand-300"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            {cta.cta_label}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </a>
          {links.whatsapp_url ? (
            <a
              href={links.whatsapp_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-14 items-center gap-2 rounded-2xl px-6 font-semibold text-white/85 ring-1 ring-white/15 hover:bg-white/5 hover:text-white"
            >
              <MessageCircle className="h-5 w-5" /> Nous écrire sur WhatsApp
            </a>
          ) : (
            <a href={links.login_url}
              target="_blank"
              rel="noopener noreferrer" className="inline-flex h-14 items-center px-6 font-semibold text-white/75 hover:text-white">
              J&apos;ai déjà un compte
            </a>
          )}
        </Item>
        {cta.note && (
          <Item as="p" className="mt-5 text-sm text-white/45">
            {cta.note}
          </Item>
        )}
      </Reveal>

      <div className="relative mt-24 overflow-hidden border-y border-white/10 py-5" aria-hidden>
        <div className="animate-marquee flex w-max gap-10">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="flex items-center gap-10 whitespace-nowrap text-lg font-semibold text-white/35">
              {t}
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400/60" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const { links, sections } = useSite().content;
  return (
    <footer className="bg-brand-950 text-white/55">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.jpg" alt="" width={32} height={32} className="rounded-lg" />
          <span className="font-extrabold tracking-tight text-white">
            Opti<span className="text-brand-400">Space</span>
          </span>
          <span className="text-sm">· Gestion des tickets & encaissements Wi-Fi</span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          {sections.showcase && <a href="#fonctionnalites" className="hover:text-white">Fonctionnalités</a>}
          {sections.pricing && <a href="#tarifs" className="hover:text-white">Tarifs</a>}
          {sections.faq && <a href="#faq" className="hover:text-white">FAQ</a>}
          <a href={links.login_url}
              target="_blank"
              rel="noopener noreferrer" className="hover:text-white">Connexion</a>
        </nav>
      </div>
      <p className="pb-8 text-center text-xs text-white/35">© {new Date().getFullYear()} OptiSpace. Tous droits réservés.</p>
    </footer>
  );
}
