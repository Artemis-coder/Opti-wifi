import React from 'react';
import { TERMS_VERSION } from '@/lib/terms';

// Texte des conditions d'utilisation : page publique /conditions (inscription) et menu
// « Conditions d'utilisation » de l'espace. Changer TERMS_VERSION (lib/terms.ts) à chaque
// modification du texte.

export const TERMS_UPDATED = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(TERMS_VERSION));

export const TERMS_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. Objet',
    body: [
      'OptiSpace (OptiWifi) est un outil en ligne de gestion des tickets Wi-Fi, des points de vente et des encaissements. Les présentes conditions encadrent l’utilisation de l’outil par l’entreprise cliente, son administrateur et ses collecteurs.',
      'Créer un compte implique l’acceptation sans réserve de ces conditions.',
    ],
  },
  {
    title: '2. Compte et accès',
    body: [
      'Les informations fournies à l’inscription doivent être exactes. Un compte n’est actif qu’après validation par l’équipe OptiWifi.',
      'Chaque utilisateur est responsable de la confidentialité de son mot de passe et de l’usage fait de son compte. L’administrateur de l’espace gère les accès de ses collecteurs.',
    ],
  },
  {
    title: '3. Abonnement',
    body: [
      'L’accès complet à l’outil dépend d’un abonnement en cours. À son expiration, l’espace passe en consultation seule : les données restent visibles, mais aucun ajout ni aucune modification n’est possible jusqu’au renouvellement.',
      'En cas de manquement à ces conditions, l’équipe OptiWifi peut suspendre l’accès à un espace.',
    ],
  },
  {
    title: '4. Confidentialité et propriété de l’outil',
    body: [
      'L’interface, son design, ses fonctionnalités et ses textes sont la propriété d’OptiWifi et sont confidentiels.',
      'Il est interdit de reproduire, copier, imiter ou diffuser tout ou partie de l’outil, notamment au moyen de captures d’écran, d’enregistrements vidéo ou d’impressions, en vue de le reproduire ou de le communiquer à un tiers.',
      'Toute reproduction non autorisée peut entraîner la suspension immédiate du compte et des poursuites.',
    ],
  },
  {
    title: '5. Données',
    body: [
      'Les données saisies (points de vente, allocations, collectes…) appartiennent à l’entreprise cliente. OptiWifi les héberge et les traite uniquement pour fournir le service.',
      'L’administrateur peut à tout moment télécharger les données de son espace et demander la suppression de son compte depuis Paramètres > Données & compte.',
    ],
  },
  {
    title: '6. Responsabilité',
    body: [
      'L’utilisateur reste responsable des informations qu’il saisit. OptiWifi met tout en œuvre pour assurer la disponibilité du service, sans garantir une absence totale d’interruption.',
    ],
  },
  {
    title: '7. Modification des conditions',
    body: [
      'Ces conditions peuvent évoluer. La version en vigueur est toujours consultable sur cette page.',
    ],
  },
];

/** Sections des conditions d'utilisation. */
export function TermsContent() {
  return (
    <>
      {TERMS_SECTIONS.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{s.title}</h2>
          {s.body.map((p) => (
            <p key={p} className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {p}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}
