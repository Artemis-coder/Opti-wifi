import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CGU } from "@/lib/legal";

export const metadata: Metadata = {
  title: `${CGU.title} — OptiSpace`,
  description: CGU.intro,
  alternates: { canonical: "/cgu" },
};

export default function Page() {
  return <LegalPage doc={CGU} />;
}
