import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ConnectionStatus } from "@/components/offline/ConnectionStatus";
import { OfflineSupport } from "@/components/offline/OfflineSupport";
import { ConfirmHost } from "@/components/ui/ConfirmDialog";
import { ErrorReporter } from "@/components/ErrorReporter";
import { AnalyticsIdentity } from "@/components/AnalyticsIdentity";

/**
 * Pose data-theme="light|dark" sur <html> d'après le réglage du système, avant le premier rendu.
 * Les variables HeroUI ne passent en sombre qu'avec cet attribut ; le reste de l'app suit déjà
 * prefers-color-scheme. Contenu fixe (aucune donnée utilisateur).
 */
const THEME_SCRIPT = `(function(){try{var m=window.matchMedia('(prefers-color-scheme: dark)');var a=function(){var d=m.matches;var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.classList.toggle('dark',d);r.classList.toggle('light',!d);};a();m.addEventListener('change',a);}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OptiSpace",
  description: "Gestion de points de vente, allocations de tickets et encaissements",
  applicationName: "OptiSpace",
  appleWebApp: { capable: true, title: "OptiSpace", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/assets/logo.jpg" },
      { url: "/icon.png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/assets/logo.jpg",
    apple: "/assets/logo.jpg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1b3f2b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ErrorReporter>
          {children}
        </ErrorReporter>
        <ConnectionStatus />
        <OfflineSupport />
        <AnalyticsIdentity />
        <ConfirmHost />
        <Toaster closeButton position="top-center" offset={72} />
      </body>
    </html>
  );
}
