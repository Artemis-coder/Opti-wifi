"use client";

import Image from "next/image";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import type { SectionKey } from "@/lib/content";
import { useSite } from "./SiteProvider";
import { EASE_OUT } from "./motion";

const ALL_SECTIONS: { href: string; label: string; key: SectionKey }[] = [
  { href: "#probleme", label: "Le problème", key: "pains" },
  { href: "#fonctionnement", label: "Comment ça marche", key: "how_it_works" },
  { href: "#fonctionnalites", label: "Fonctionnalités", key: "showcase" },
  { href: "#tarifs", label: "Tarifs", key: "pricing" },
  { href: "#faq", label: "FAQ", key: "faq" },
];

export function Nav() {
  const { content } = useSite();
  const links = content.links;
  const SECTIONS = ALL_SECTIONS.filter((s) => content.sections[s.key]);
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6"
    >
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-3 py-2.5 transition-all duration-500 sm:px-4 ${
          scrolled || open
            ? "bg-brand-950/80 shadow-lg shadow-black/20 ring-1 ring-white/10 backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <a href="#top" className="flex items-center gap-2.5" aria-label="OptiSpace, retour en haut">
          <Image src="/logo.jpg" alt="" width={36} height={36} className="rounded-xl ring-1 ring-brand-400/30" />
          <span className="text-lg font-extrabold tracking-tight text-white">
            Opti<span className="text-brand-400">Space</span>
          </span>
        </a>

        <ul className="hidden items-center gap-1 lg:flex">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href={links.login_url}
            className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-white/80 transition-colors hover:text-white sm:block"
          >
            Se connecter
          </a>
          <a
            href={links.signup_url}
            className="rounded-xl bg-brand-400 px-4 py-2 text-sm font-bold text-brand-on shadow-[0_0_0_0_rgb(132_200_101/0.5)] transition-all hover:bg-brand-300 hover:shadow-[0_0_24px_0_rgb(132_200_101/0.45)]"
          >
            Essai gratuit
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-xl text-white lg:hidden"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="mx-auto mt-2 max-w-6xl space-y-1 rounded-2xl bg-brand-950/95 p-2 ring-1 ring-white/10 backdrop-blur-xl lg:hidden"
          >
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-4 py-3 text-base font-medium text-white/85 hover:bg-white/5"
                >
                  {s.label}
                </a>
              </li>
            ))}
            <li>
              <a href={links.login_url} className="block rounded-xl px-4 py-3 text-base font-semibold text-brand-300">
                Se connecter
              </a>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
