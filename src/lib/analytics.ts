"use client";

import posthog from "posthog-js";

/** Événement du site vitrine (sans effet si PostHog n'est pas configuré). */
export function track(event: "calculator_used" | "faq_opened", properties: Record<string, string | number | boolean | null> = {}) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // le suivi ne doit jamais casser la page
  }
}
