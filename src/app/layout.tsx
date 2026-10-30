import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.optiwifi.site"),
  title: "OptiSpace — Chaque ticket Wi-Fi vendu, chaque franc encaissé",
  description:
    "Le logiciel des gérants de zones Wi-Fi : suivez vos tickets par point de vente, encaissez vos collecteurs sans écart et pilotez tout votre réseau depuis votre téléphone.",
  applicationName: "OptiSpace",
  icons: { icon: "/logo.jpg", apple: "/logo.jpg" },
  openGraph: {
    title: "OptiSpace — Chaque ticket Wi-Fi vendu, chaque franc encaissé",
    description:
      "Tickets, points de vente, collecteurs et encaissements réunis dans un seul outil. Essai gratuit.",
    images: ["/screens/dashboard.png"],
    locale: "fr_FR",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b3f2b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
