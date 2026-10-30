"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Site } from "@/lib/content";

const SiteContext = createContext<Site | null>(null);

/** Contenu géré depuis le back-office, disponible dans toutes les sections. */
export function SiteProvider({ site, children }: { site: Site; children: ReactNode }) {
  return <SiteContext.Provider value={site}>{children}</SiteContext.Provider>;
}

export function useSite(): Site {
  const site = useContext(SiteContext);
  if (!site) throw new Error("useSite doit être utilisé dans <SiteProvider>");
  return site;
}
