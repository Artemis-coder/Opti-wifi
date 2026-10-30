import posthog from "posthog-js";

// PostHog du site vitrine : même projet que l'outil. Le cookie est posé sur
// .optiwifi.site, donc un visiteur garde le même identifiant de space.optiwifi.site
// à www.optiwifi.site (tunnel visite → clic → inscription). Désactivé sans clé.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  try {
    posthog.init(key, {
      api_host: "/ingest",
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com",
      defaults: "2026-08-30",
      person_profiles: "identified_only",
      cross_subdomain_cookie: true,
    });
    posthog.register({
      app: "site",
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : process.env.NEXT_PUBLIC_VERCEL_ENV || "development",
    });

    // Clics sur les appels à l'action : <a data-cta="signup|login|whatsapp" data-cta-location="hero|nav|…">
    document.addEventListener(
      "click",
      (e) => {
        const link = (e.target as Element | null)?.closest?.("[data-cta]") as HTMLElement | null;
        if (!link) return;
        posthog.capture("cta_clicked", {
          cta: link.dataset.cta,
          location: link.dataset.ctaLocation,
          plan: link.dataset.ctaPlan,
          label: link.textContent?.trim().slice(0, 60),
        });
      },
      { capture: true },
    );
  } catch (err) {
    console.error("PostHog init error:", err);
  }
}
