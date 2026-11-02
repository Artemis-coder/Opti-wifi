import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://space.optiwifi.site").replace(/\/$/, "");

// Plan du site pour Google Search Console : page d'accueil et documents légaux.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/cgu`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/cgv`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
