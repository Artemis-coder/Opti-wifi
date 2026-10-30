import type { Metadata } from "next";
import { MotionConfig } from "motion/react";
import { getSite } from "@/lib/content";
import { Audience } from "@/components/Audience";
import { Calculator } from "@/components/Calculator";
import { FinalCta, Footer } from "@/components/Closing";
import { Faq } from "@/components/Faq";
import { Field } from "@/components/Field";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Nav } from "@/components/Nav";
import { Pains } from "@/components/Pains";
import { Pricing } from "@/components/Pricing";
import { Showcase } from "@/components/Showcase";
import { SiteProvider } from "@/components/SiteProvider";

// Contenu géré depuis le back-office : page régénérée au plus toutes les 60 s.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = (await getSite()).content;
  return {
    title: seo.title,
    description: seo.description,
    openGraph: { title: seo.title, description: seo.description, images: ["/screens/dashboard.png"], locale: "fr_FR", type: "website" },
  };
}

/*
 * Parcours de conversion :
 * accroche → douleur (« ça vous parle ? ») → chiffrage de la perte → méthode
 * → preuve par les vrais écrans → terrain/mobile → identification → offre → objections → appel final.
 */
export default async function LandingPage() {
  const site = await getSite();
  const show = site.content.sections;

  return (
    <SiteProvider site={site}>
      <MotionConfig reducedMotion="user">
        <Nav />
        <main>
          <Hero />
          {show.pains && <Pains />}
          {show.calculator && <Calculator />}
          {show.how_it_works && <HowItWorks />}
          {show.showcase && <Showcase />}
          {show.field && <Field />}
          {show.audience && <Audience />}
          {show.pricing && <Pricing />}
          {show.faq && <Faq />}
          {show.final_cta && <FinalCta />}
        </main>
        <Footer />
      </MotionConfig>
    </SiteProvider>
  );
}
