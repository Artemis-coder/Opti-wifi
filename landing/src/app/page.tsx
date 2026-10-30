import { MotionConfig } from "motion/react";
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

/*
 * Parcours de conversion :
 * accroche → douleur (« ça vous parle ? ») → chiffrage de la perte → méthode
 * → preuve par les vrais écrans → terrain/mobile → identification → offre → objections → appel final.
 */
export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <Nav />
      <main>
        <Hero />
        <Pains />
        <Calculator />
        <HowItWorks />
        <Showcase />
        <Field />
        <Audience />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </MotionConfig>
  );
}
