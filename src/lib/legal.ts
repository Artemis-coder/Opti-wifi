/**
 * CGU et CGV d'OptiSpace.
 *
 * Source : back-office de l'outil → Site vitrine → CGU / CGV (table site_content),
 * lue via l'API publique. Les textes ci-dessous servent de secours si l'API ne répond
 * pas : garder les mêmes que src/lib/legal-defaults.ts de l'outil (branche develop).
 *
 * Corps d'une section : paragraphes séparés par une ligne vide ; « - » en début de ligne = puce.
 */

export type LegalSlug = "cgu" | "cgv";
export type LegalSection = { title: string; body: string };
export type LegalDoc = { version: string; updated_at: string; intro: string; sections: LegalSection[] };

export const LEGAL_META: Record<LegalSlug, { short: string; title: string; pdf: string }> = {
  cgu: { short: "CGU", title: "Conditions générales d'utilisation", pdf: "/legal/optispace-cgu.pdf" },
  cgv: { short: "CGV", title: "Conditions générales de vente", pdf: "/legal/optispace-cgv.pdf" },
};

export const DEFAULT_LEGAL: Record<LegalSlug, LegalDoc> = {
  "cgu": {
    "version": "1.0",
    "updated_at": "2026-11-02",
    "intro": "Les présentes conditions encadrent l'utilisation du site space.optiwifi.site et de l'application OptiSpace (www.optiwifi.site), ainsi que la manière dont les données des utilisateurs sont collectées, utilisées et protégées.",
    "sections": [
      {
        "title": "1. Éditeur et objet",
        "body": "Éditeur du service : Optimus Group.\n\nSiège : Cocody Deux-Plateaux, Abidjan, Côte d'Ivoire. Contact : support@optiwifi.site — WhatsApp : +225 01 40 74 76.\n\nResponsable de la publication : Optimus Group.\n\nOptiSpace est un logiciel en ligne de gestion des tickets Wi-Fi, des points de vente, des collecteurs et des encaissements, destiné aux gérants de zones Wi-Fi.\n\nCréer un compte ou utiliser le service vaut acceptation des présentes CGU. L'abonnement payant est en outre régi par les conditions générales de vente (CGV)."
      },
      {
        "title": "2. Compte utilisateur",
        "body": "- La création d'un compte est réservée aux professionnels. Elle est validée par l'équipe OptiSpace avant l'ouverture de l'accès.\n- L'administrateur du compte peut créer des accès pour ses collecteurs ; chacun ne voit que ce que son rôle autorise.\n- Les identifiants sont personnels et confidentiels. Toute action faite avec un compte est réputée faite par son titulaire.\n- En cas de perte ou de soupçon d'usage frauduleux, l'utilisateur doit changer son mot de passe et prévenir le support sans délai."
      },
      {
        "title": "3. Données collectées",
        "body": "OptiSpace ne collecte que les données nécessaires à la création du compte et au fonctionnement du service :\n\n- À l'inscription : nom de l'entreprise, nom du gérant, adresse e-mail, numéro de téléphone (avec le pays) et mot de passe. Le mot de passe n'est jamais conservé en clair.\n- Pour les membres ajoutés par l'administrateur (collecteurs) : nom, adresse e-mail et rôle.\n- Les données d'activité saisies par l'utilisateur : points de vente, espaces Wi-Fi, types de tickets, allocations, encaissements, commissions.\n- Le pays de connexion (déduit de l'adresse IP, sans conserver l'adresse elle-même), pour adapter les moyens de paiement proposés.\n- Des statistiques d'utilisation pseudonymes (pages vues, actions effectuées), rattachées à un identifiant interne, sans nom, e-mail ni téléphone."
      },
      {
        "title": "4. Utilisation des données",
        "body": "Les données sont utilisées uniquement pour créer et gérer le compte de l'utilisateur et lui fournir le service OptiSpace. Elles ne sont jamais utilisées en dehors de ce cadre :\n\n- elles ne sont ni vendues, ni louées, ni cédées à des tiers ;\n- elles ne sont pas utilisées à des fins publicitaires ni transmises à des annonceurs ;\n- elles ne servent qu'à : ouvrir et sécuriser le compte, faire fonctionner l'outil, gérer l'abonnement et la facturation, envoyer les notifications liées au compte (validation, rappels d'expiration, sécurité), répondre aux demandes de support et améliorer le service à partir de statistiques pseudonymes.\n\nLes données d'activité saisies par un client (points de vente, encaissements…) lui appartiennent. Elles ne sont visibles que par les membres de son organisation et par l'équipe OptiSpace pour l'assistance et la maintenance."
      },
      {
        "title": "5. Sécurité des données",
        "body": "Les données collectées sont protégées par des mesures techniques et organisationnelles adaptées :\n\n- tous les échanges passent par une connexion chiffrée (HTTPS) ;\n- les mots de passe sont chiffrés de manière irréversible (hachage bcrypt) et ne sont connus de personne, pas même de l'équipe OptiSpace ;\n- chaque organisation est isolée : un client ne peut ni voir ni modifier les données d'un autre client ;\n- l'accès est contrôlé par rôle (administrateur, collecteur) et la session est protégée par un cookie sécurisé ;\n- les actions sensibles de l'équipe OptiSpace sont tracées dans un journal d'audit ;\n- la base de données fait l'objet de sauvegardes régulières.\n\nAucun système n'étant infaillible, OptiSpace s'engage à informer les utilisateurs concernés dans les meilleurs délais en cas de violation de données susceptible de les affecter."
      },
      {
        "title": "6. Hébergement et prestataires techniques",
        "body": "Pour fonctionner, OptiSpace s'appuie sur des prestataires techniques qui traitent les données uniquement pour son compte et selon ses instructions :\n\n- Vercel Inc. (hébergement de l'application et du site) ;\n- Neon (base de données, hébergée sur Amazon Web Services aux États-Unis) ;\n- un service d'envoi d'e-mails (messages liés au compte) ;\n- Telegram (alertes internes à l'équipe OptiSpace, par exemple une nouvelle inscription à valider) ;\n- des fournisseurs d'intelligence artificielle (assistant interne utilisé par l'équipe OptiSpace pour l'administration de la plateforme) ;\n- PostHog et Vercel Analytics (statistiques d'utilisation pseudonymes).\n\nCertains de ces prestataires sont situés hors de Côte d'Ivoire, notamment aux États-Unis. Ces transferts sont limités à ce qui est nécessaire au service et encadrés conformément à la réglementation applicable."
      },
      {
        "title": "7. Durée de conservation",
        "body": "- Les données du compte sont conservées tant que le compte est actif.\n- En cas d'expiration ou de suspension de l'abonnement, l'accès est coupé mais les données sont conservées pour permettre la reprise du service.\n- À la demande de l'utilisateur, le compte et ses données sont supprimés dans un délai de 30 jours, sous réserve des documents que la loi impose de conserver (factures notamment)."
      },
      {
        "title": "8. Vos droits",
        "body": "Conformément à la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel, chaque utilisateur dispose d'un droit d'accès, de rectification, d'opposition et de suppression de ses données.\n\nPour exercer ces droits : support@optiwifi.site. Une réponse est apportée dans un délai d'un mois. L'utilisateur peut également saisir l'Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire (ARTCI)."
      },
      {
        "title": "9. Cookies",
        "body": "OptiSpace utilise un cookie indispensable à la connexion (session sécurisée) et des cookies de mesure d'audience pseudonymes (PostHog), partagés entre space.optiwifi.site et www.optiwifi.site pour comprendre le parcours des visiteurs. Ils ne servent pas à la publicité. Ils peuvent être supprimés à tout moment depuis les réglages du navigateur."
      },
      {
        "title": "10. Règles d'utilisation",
        "body": "- L'utilisateur s'engage à saisir des informations exactes et à utiliser le service conformément à la loi.\n- Il est interdit de tenter d'accéder aux données d'un autre client, de perturber le service ou d'en contourner les protections.\n- Le logiciel, le site, la marque et les contenus OptiSpace sont protégés : toute reproduction ou réutilisation sans autorisation écrite est interdite.\n- En cas de manquement, OptiSpace peut suspendre l'accès au compte."
      },
      {
        "title": "11. Modification des CGU et droit applicable",
        "body": "OptiSpace peut faire évoluer les présentes CGU. La version en vigueur est celle publiée sur le site, avec sa date de mise à jour ; les utilisateurs sont informés de toute modification importante.\n\nLes présentes CGU sont soumises au droit ivoirien. À défaut d'accord amiable, tout litige relève des juridictions compétentes d'Abidjan, Côte d'Ivoire."
      }
    ]
  },
  "cgv": {
    "version": "1.0",
    "updated_at": "2026-11-02",
    "intro": "Les présentes conditions régissent la souscription et l'utilisation des abonnements payants au logiciel OptiSpace. Elles complètent les conditions générales d'utilisation (CGU).",
    "sections": [
      {
        "title": "1. Vendeur",
        "body": "Éditeur du service : Optimus Group.\n\nSiège : Cocody Deux-Plateaux, Abidjan, Côte d'Ivoire. Contact : support@optiwifi.site — WhatsApp : +225 01 40 74 76.\n\nResponsable de la publication : Optimus Group."
      },
      {
        "title": "2. Service proposé",
        "body": "OptiSpace est un logiciel accessible en ligne (sur ordinateur et téléphone) permettant de gérer les tickets Wi-Fi, les points de vente, les collecteurs, les allocations et les encaissements. Le service est fourni par abonnement, sans installation."
      },
      {
        "title": "3. Forfaits et prix",
        "body": "- Les forfaits, leurs prix et leurs limites (points de vente, utilisateurs, collecteurs, tickets par mois, jours d'essai) sont ceux affichés sur space.optiwifi.site et dans l'espace client au moment de la souscription.\n- Les prix sont indiqués en francs CFA (XOF). À la date de mise à jour des présentes : Découverte 2 599 FCFA par mois, Standard 5 999 FCFA par mois, Décideur (Pro) 35 999 FCFA par mois.\n- OptiSpace peut faire évoluer ses prix ; un nouveau prix ne s'applique qu'au renouvellement suivant."
      },
      {
        "title": "4. Période d'essai",
        "body": "Selon le forfait, une période d'essai gratuite peut être proposée lors de la première souscription d'une organisation. Elle n'est accordée qu'une seule fois. À son terme, aucun prélèvement n'est effectué automatiquement : l'utilisateur choisit librement de souscrire un abonnement payant."
      },
      {
        "title": "5. Souscription et paiement",
        "body": "- La souscription se fait depuis l'espace client (« Me réabonner ») : choix du forfait, paiement par l'un des moyens proposés (notamment Wave), puis envoi du justificatif.\n- La licence est activée après vérification du paiement par l'équipe OptiSpace. Une facture est alors émise et téléchargeable au format PDF depuis l'espace client.\n- Aucune donnée bancaire n'est collectée ni conservée par OptiSpace : le paiement est réalisé directement auprès de l'opérateur choisi."
      },
      {
        "title": "6. Durée et renouvellement",
        "body": "- L'abonnement court pour la durée choisie à compter de son activation.\n- Il n'est pas reconduit automatiquement : des rappels sont envoyés avant l'échéance (10, 5 et 2 jours avant), puis après.\n- À l'échéance sans renouvellement, l'accès à l'outil est suspendu ; les données sont conservées et l'accès est rétabli dès le renouvellement."
      },
      {
        "title": "7. Rétractation et remboursement",
        "body": "Le service étant destiné aux professionnels et accessible dès son activation, aucun remboursement n'est dû pour une période entamée, sauf en cas d'indisponibilité du service imputable à OptiSpace."
      },
      {
        "title": "8. Obligations d'OptiSpace",
        "body": "- Fournir l'accès au service souscrit et assurer sa maintenance.\n- Mettre en œuvre les mesures de sécurité décrites dans les CGU et n'utiliser les données du client que pour lui fournir le service.\n- Répondre aux demandes de support depuis l'espace client.\n\nOptiSpace s'efforce d'assurer un service disponible en continu, sans pouvoir le garantir : des interruptions peuvent survenir pour maintenance ou en raison de prestataires techniques ou de réseaux tiers."
      },
      {
        "title": "9. Obligations du client",
        "body": "- Payer l'abonnement choisi et fournir des informations exactes.\n- Respecter les limites de son forfait et les règles d'utilisation des CGU.\n- Vérifier les données qu'il saisit : OptiSpace calcule les montants à partir de ces saisies et ne peut être tenu responsable d'une erreur de saisie."
      },
      {
        "title": "10. Responsabilité",
        "body": "OptiSpace est un outil d'aide à la gestion : la gestion commerciale et financière de l'activité du client reste de sa responsabilité. La responsabilité d'OptiSpace, si elle est engagée, est limitée au montant payé par le client au titre des douze derniers mois d'abonnement."
      },
      {
        "title": "11. Suspension et résiliation",
        "body": "- Le client peut cesser d'utiliser le service à tout moment en ne renouvelant pas son abonnement, ou demander la suppression de son compte (voir CGU).\n- OptiSpace peut suspendre un compte en cas de non-paiement, de fraude ou de manquement grave aux CGU."
      },
      {
        "title": "12. Données personnelles",
        "body": "Les données nécessaires à la souscription (identité du gérant, coordonnées, forfait, paiements et factures) sont utilisées uniquement pour gérer l'abonnement et fournir le service, et sont protégées comme décrit dans les CGU. Elles ne sont jamais vendues ni utilisées à d'autres fins."
      },
      {
        "title": "13. Droit applicable et litiges",
        "body": "Les présentes CGV sont soumises au droit ivoirien. Les parties recherchent d'abord une solution amiable ; à défaut, le litige relève des juridictions compétentes d'Abidjan, Côte d'Ivoire."
      }
    ]
  }
};

export type LegalBlock = { type: "p"; text: string } | { type: "ul"; items: string[] };

/** Découpe le texte d'une section en paragraphes et listes à puces. */
export function legalBlocks(body: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  for (const chunk of body.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    let para: string[] = [];
    let list: string[] = [];
    const flushPara = () => {
      if (para.length) blocks.push({ type: "p", text: para.join(" ") });
      para = [];
    };
    const flushList = () => {
      if (list.length) blocks.push({ type: "ul", items: list });
      list = [];
    };
    for (const line of lines) {
      if (/^[-•]\s+/.test(line)) {
        flushPara();
        list.push(line.replace(/^[-•]\s+/, ""));
      } else {
        flushList();
        para.push(line);
      }
    }
    flushPara();
    flushList();
  }
  return blocks;
}

/** « 2026-11-02 » → « 2 novembre 2026 ». */
export function formatLegalDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Ancre d'une section (« 3. Données collectées » → « donnees-collectees »). */
export function legalAnchor(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
