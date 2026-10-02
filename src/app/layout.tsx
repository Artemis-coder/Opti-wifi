import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { APP, BRAND } from "@/lib/design-system";
import { StandaloneConnectionStatus } from "@/components/offline/ConnectionStatus";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP.name,
  description: "Gestion de points de vente, allocations de tickets et encaissements",
  applicationName: APP.name,
  appleWebApp: { capable: true, title: APP.name, statusBarStyle: "black-translucent" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/assets/logo.jpg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: BRAND.chrome,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <StandaloneConnectionStatus />
        <Toaster closeButton position="top-center" offset={72} />
      </body>
    </html>
  );
}
