import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getLegal } from "@/lib/content";
import { LEGAL_META } from "@/lib/legal";

// Texte géré dans le back-office : page régénérée au plus toutes les 60 s.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getLegal("cgv");
  return {
    title: `${LEGAL_META.cgv.title} — OptiSpace`,
    description: doc.intro.slice(0, 160),
    alternates: { canonical: "/cgv" },
  };
}

export default async function Page() {
  return <LegalPage slug="cgv" doc={await getLegal("cgv")} />;
}
