"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { BellRing, CloudOff, UserCog, Wifi } from "lucide-react";
import { useRef } from "react";
import { Item, Reveal, SectionTag } from "./motion";

const POINTS = [
  {
    icon: CloudOff,
    title: "Marche même sans réseau",
    text: "Pas de connexion dans la boutique ? Les saisies attendent sur le téléphone et partent toutes seules au retour du réseau.",
  },
  {
    icon: UserCog,
    title: "Un rôle pour chacun",
    text: "Vous êtes administrateur, vos collecteurs n'ont accès qu'à ce dont ils ont besoin. Vous gardez la main sur tout.",
  },
  {
    icon: BellRing,
    title: "Prévenu à temps",
    text: "Notifications dans l'application et sur le téléphone, même quand le site est fermé.",
  },
];

export function Field() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yBack = useTransform(scrollYProgress, [0, 1], [80, -60]);
  const yFront = useTransform(scrollYProgress, [0, 1], [140, -120]);
  const rot = useTransform(scrollYProgress, [0, 1], [-8, -2]);

  return (
    <section ref={ref} className="relative overflow-hidden bg-brand-950 py-24 text-white sm:py-32">
      <div className="grid-fade pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -left-40 top-1/3 h-[500px] w-[500px] rounded-full bg-brand-500/20 blur-[120px]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <SectionTag dark>Sur le terrain</SectionTag>
          <Item as="h2" className="mt-5 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
            Votre bureau tient <span className="text-gradient">dans votre poche.</span>
          </Item>
          <Item as="p" className="mt-5 text-lg leading-relaxed text-white/65">
            Vous n&apos;êtes pas derrière un ordinateur, vous êtes dans les quartiers. OptiSpace a été construit d&apos;abord
            pour le téléphone : gros boutons, écrans simples, tout à portée de pouce.
          </Item>
          <div className="mt-10 space-y-6">
            {POINTS.map((p) => (
              <Item key={p.title} className="flex gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-400/10 text-brand-300 ring-1 ring-brand-400/20">
                  <p.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white">{p.title}</h3>
                  <p className="mt-1 leading-relaxed text-white/60">{p.text}</p>
                </div>
              </Item>
            ))}
          </div>
        </Reveal>

        <div className="relative mx-auto h-[560px] w-full max-w-md sm:h-[640px]">
          <motion.div style={{ y: yBack, rotate: rot }} className="absolute left-0 top-6 w-[54%]">
            <Phone src="/screens/m-dashboard.png" alt="Tableau de bord OptiSpace sur téléphone" />
          </motion.div>
          <motion.div style={{ y: yFront }} className="absolute right-0 top-20 w-[56%]">
            <Phone src="/screens/m-collection-new.png" alt="Assistant d'encaissement OptiSpace sur téléphone" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 20 }}
            className="absolute bottom-10 left-4 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shot-shadow"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
            </span>
            <Wifi className="h-4 w-4 text-brand-600" /> Synchronisé
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Phone({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-[2.4rem] bg-[#0b130e] p-2.5 ring-1 ring-white/15 shot-shadow">
      <div className="relative overflow-hidden rounded-[1.9rem] bg-white">
        <span className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <Image src={src} alt={alt} width={780} height={1688} className="h-auto w-full" />
      </div>
    </div>
  );
}
