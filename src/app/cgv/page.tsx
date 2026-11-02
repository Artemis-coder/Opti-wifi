import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CGV } from "@/lib/legal";

export const metadata: Metadata = {
  title: `${CGV.title} — OptiSpace`,
  description: CGV.intro,
  alternates: { canonical: "/cgv" },
};

export default function Page() {
  return <LegalPage doc={CGV} />;
}
