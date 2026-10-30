import path from "node:path";
import type { NextConfig } from "next";

// Relais PostHog : /ingest sur le même domaine (contourne les bloqueurs de publicité).
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const POSTHOG_ASSETS = POSTHOG_HOST.replace(".i.posthog.com", "-assets.i.posthog.com");

// Application autonome : le site vitrine ne partage rien avec l'outil (../src).
const nextConfig: NextConfig = {
  turbopack: { root: path.join(__dirname) },
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: `${POSTHOG_ASSETS}/static/:path*` },
      { source: "/ingest/array/:path*", destination: `${POSTHOG_ASSETS}/array/:path*` },
      { source: "/ingest/:path*", destination: `${POSTHOG_HOST}/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
