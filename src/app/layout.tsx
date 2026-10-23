import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ConnectionStatus } from "@/components/offline/ConnectionStatus";
import { ErrorReporter } from "@/components/ErrorReporter";

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
    >
      <body className="min-h-full flex flex-col">
        <ErrorReporter>
          {children}
        </ErrorReporter>
        <ConnectionStatus />
        <Toaster closeButton position="top-center" offset={72} />
      </body>
    </html>
  );
}
