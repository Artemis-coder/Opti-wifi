/**
 * Conditions générales d'utilisation (CGU) et de vente (CGV) d'OptiSpace.
 * Source unique : pages /cgu et /cgv, et PDF téléchargeables (npm run legal:pdf).
 *
 * Les mentions « [À COMPLÉTER : …] » doivent être renseignées par l'éditeur
 * avant publication (elles sont surlignées sur la page).
 * Toute modification : mettre à jour VERSION et UPDATED_AT, puis régénérer les PDF.
 */

export const VERSION = "1.0";
export const UPDATED_AT = "2 novembre 2026";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  list?: string[];
  after?: string[];
};

export type LegalDoc = {
  slug: "cgu" | "cgv";
  short: string;
  title: string;
  intro: string;
  pdf: string;
  sections: LegalSection[];
};

const EDITOR = [
  "Éditeur du service : Optimus Group.",
  "Siège : Cocody Deux-Plateaux, Abidjan, Côte d'Ivoire. Contact : [À COMPLÉTER : e-mail OptiSpace] — WhatsApp : +225 01 40 74 76.",
  "Responsable de la publication : Optimus Group.",
];

export const CGU: LegalDoc = {
  slug: "cgu",
  short: "CGU",
  title: "Conditions générales d'utilisation",
  intro:
    "Les présentes conditions encadrent l'utilisation du site space.optiwifi.site et de l'application OptiSpace (www.optiwifi.site), ainsi que la manière dont les données des utilisateurs sont collectées, utilisées et protégées.",
  pdf: "/legal/optispace-cgu.pdf",
  sections: [
    {
      id: "editeur",
      title: "1. Éditeur et objet",
      paragraphs: [
        ...EDITOR,
        "OptiSpace est un logiciel en ligne de gestion des tickets Wi-Fi, des points de vente, des collecteurs et des encaissements, destiné aux gérants de zones Wi-Fi.",
        "Créer un compte ou utiliser le service vaut acceptation des présentes CGU. L'abonnement payant est en outre régi par les conditions générales de vente (CGV).",
      ],
    },
    {
      id: "compte",
      title: "2. Compte utilisateur",
      list: [
        "La création d'un compte est réservée aux professionnels. Elle est validée par l'équipe OptiSpace avant l'ouverture de l'accès.",
        "L'administrateur du compte peut créer des accès pour ses collecteurs ; chacun ne voit que ce que son rôle autorise.",
        "Les identifiants sont personnels et confidentiels. Toute action faite avec un compte est réputée faite par son titulaire.",
        "En cas de perte ou de soupçon d'usage frauduleux, l'utilisateur doit changer son mot de passe et prévenir le support sans délai.",
      ],
    },
    {
      id: "donnees-collectees",
      title: "3. Données collectées",
      paragraphs: ["OptiSpace ne collecte que les données nécessaires à la création du compte et au fonctionnement du service :"],
      list: [
        "À l'inscription : nom de l'entreprise, nom du gérant, adresse e-mail, numéro de téléphone (avec le pays) et mot de passe. Le mot de passe n'est jamais conservé en clair.",
        "Pour les membres ajoutés par l'administrateur (collecteurs) : nom, adresse e-mail et rôle.",
        "Les données d'activité saisies par l'utilisateur : points de vente, espaces Wi-Fi, types de tickets, allocations, encaissements, commissions.",
        "Le pays de connexion (déduit de l'adresse IP, sans conserver l'adresse elle-même), pour adapter les moyens de paiement proposés.",
        "Des statistiques d'utilisation pseudonymes (pages vues, actions effectuées), rattachées à un identifiant interne, sans nom, e-mail ni téléphone.",
      ],
    },
    {
      id: "utilisation",
      title: "4. Utilisation des données",
      paragraphs: [
        "Les données sont utilisées uniquement pour créer et gérer le compte de l'utilisateur et lui fournir le service OptiSpace. Elles ne sont jamais utilisées en dehors de ce cadre :",
      ],
      list: [
        "elles ne sont ni vendues, ni louées, ni cédées à des tiers ;",
        "elles ne sont pas utilisées à des fins publicitaires ni transmises à des annonceurs ;",
        "elles ne servent qu'à : ouvrir et sécuriser le compte, faire fonctionner l'outil, gérer l'abonnement et la facturation, envoyer les notifications liées au compte (validation, rappels d'expiration, sécurité), répondre aux demandes de support et améliorer le service à partir de statistiques pseudonymes.",
      ],
      after: [
        "Les données d'activité saisies par un client (points de vente, encaissements…) lui appartiennent. Elles ne sont visibles que par les membres de son organisation et par l'équipe OptiSpace pour l'assistance et la maintenance.",
      ],
    },
    {
      id: "securite",
      title: "5. Sécurité des données",
      paragraphs: ["Les données collectées sont protégées par des mesures techniques et organisationnelles adaptées :"],
      list: [
        "tous les échanges passent par une connexion chiffrée (HTTPS) ;",
        "les mots de passe sont chiffrés de manière irréversible (hachage bcrypt) et ne sont connus de personne, pas même de l'équipe OptiSpace ;",
        "chaque organisation est isolée : un client ne peut ni voir ni modifier les données d'un autre client ;",
        "l'accès est contrôlé par rôle (administrateur, collecteur) et la session est protégée par un cookie sécurisé ;",
        "les actions sensibles de l'équipe OptiSpace sont tracées dans un journal d'audit ;",
        "la base de données fait l'objet de sauvegardes régulières.",
      ],
      after: [
        "Aucun système n'étant infaillible, OptiSpace s'engage à informer les utilisateurs concernés dans les meilleurs délais en cas de violation de données susceptible de les affecter.",
      ],
    },
    {
      id: "prestataires",
      title: "6. Hébergement et prestataires techniques",
      paragraphs: [
        "Pour fonctionner, OptiSpace s'appuie sur des prestataires techniques qui traitent les données uniquement pour son compte et selon ses instructions :",
      ],
      list: [
        "Vercel Inc. (hébergement de l'application et du site) ;",
        "Neon (base de données, hébergée sur Amazon Web Services aux États-Unis) ;",
        "un service d'envoi d'e-mails (messages liés au compte) ;",
        "Telegram (alertes internes à l'équipe OptiSpace, par exemple une nouvelle inscription à valider) ;",
        "des fournisseurs d'intelligence artificielle (assistant interne utilisé par l'équipe OptiSpace pour l'administration de la plateforme) ;",
        "PostHog et Vercel Analytics (statistiques d'utilisation pseudonymes).",
      ],
      after: [
        "Certains de ces prestataires sont situés hors de Côte d'Ivoire, notamment aux États-Unis. Ces transferts sont limités à ce qui est nécessaire au service et encadrés conformément à la réglementation applicable.",
      ],
    },
    {
      id: "conservation",
      title: "7. Durée de conservation",
      list: [
        "Les données du compte sont conservées tant que le compte est actif.",
        "En cas d'expiration ou de suspension de l'abonnement, l'accès est coupé mais les données sont conservées pour permettre la reprise du service.",
        "À la demande de l'utilisateur, le compte et ses données sont supprimés dans un délai de 30 jours, sous réserve des documents que la loi impose de conserver (factures notamment).",
      ],
    },
    {
      id: "droits",
      title: "8. Vos droits",
      paragraphs: [
        "Conformément à la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel, chaque utilisateur dispose d'un droit d'accès, de rectification, d'opposition et de suppression de ses données.",
        "Pour exercer ces droits : [À COMPLÉTER : e-mail OptiSpace]. Une réponse est apportée dans un délai d'un mois. L'utilisateur peut également saisir l'Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire (ARTCI).",
      ],
    },
    {
      id: "cookies",
      title: "9. Cookies",
      paragraphs: [
        "OptiSpace utilise un cookie indispensable à la connexion (session sécurisée) et des cookies de mesure d'audience pseudonymes (PostHog), partagés entre space.optiwifi.site et www.optiwifi.site pour comprendre le parcours des visiteurs. Ils ne servent pas à la publicité. Ils peuvent être supprimés à tout moment depuis les réglages du navigateur.",
      ],
    },
    {
      id: "usage",
      title: "10. Règles d'utilisation",
      list: [
        "L'utilisateur s'engage à saisir des informations exactes et à utiliser le service conformément à la loi.",
        "Il est interdit de tenter d'accéder aux données d'un autre client, de perturber le service ou d'en contourner les protections.",
        "Le logiciel, le site, la marque et les contenus OptiSpace sont protégés : toute reproduction ou réutilisation sans autorisation écrite est interdite.",
        "En cas de manquement, OptiSpace peut suspendre l'accès au compte.",
      ],
    },
    {
      id: "modification",
      title: "11. Modification des CGU et droit applicable",
      paragraphs: [
        "OptiSpace peut faire évoluer les présentes CGU. La version en vigueur est celle publiée sur le site, avec sa date de mise à jour ; les utilisateurs sont informés de toute modification importante.",
        "Les présentes CGU sont soumises au droit ivoirien. À défaut d'accord amiable, tout litige relève des juridictions compétentes d'Abidjan, Côte d'Ivoire.",
      ],
    },
  ],
};

export const CGV: LegalDoc = {
  slug: "cgv",
  short: "CGV",
  title: "Conditions générales de vente",
  intro:
    "Les présentes conditions régissent la souscription et l'utilisation des abonnements payants au logiciel OptiSpace. Elles complètent les conditions générales d'utilisation (CGU).",
  pdf: "/legal/optispace-cgv.pdf",
  sections: [
    {
      id: "vendeur",
      title: "1. Vendeur",
      paragraphs: [...EDITOR],
    },
    {
      id: "service",
      title: "2. Service proposé",
      paragraphs: [
        "OptiSpace est un logiciel accessible en ligne (sur ordinateur et téléphone) permettant de gérer les tickets Wi-Fi, les points de vente, les collecteurs, les allocations et les encaissements. Le service est fourni par abonnement, sans installation.",
      ],
    },
    {
      id: "forfaits",
      title: "3. Forfaits et prix",
      list: [
        "Les forfaits, leurs prix et leurs limites (points de vente, utilisateurs, collecteurs, tickets par mois, jours d'essai) sont ceux affichés sur space.optiwifi.site et dans l'espace client au moment de la souscription.",
        "Les prix sont indiqués en francs CFA (XOF), [À COMPLÉTER : TTC / hors taxes].",
        "OptiSpace peut faire évoluer ses prix ; un nouveau prix ne s'applique qu'au renouvellement suivant.",
      ],
    },
    {
      id: "essai",
      title: "4. Période d'essai",
      paragraphs: [
        "Selon le forfait, une période d'essai gratuite peut être proposée lors de la première souscription d'une organisation. Elle n'est accordée qu'une seule fois. À son terme, aucun prélèvement n'est effectué automatiquement : l'utilisateur choisit librement de souscrire un abonnement payant.",
      ],
    },
    {
      id: "commande",
      title: "5. Souscription et paiement",
      list: [
        "La souscription se fait depuis l'espace client (« Me réabonner ») : choix du forfait, paiement par l'un des moyens proposés (notamment Wave), puis envoi du justificatif.",
        "La licence est activée après vérification du paiement par l'équipe OptiSpace. Une facture est alors émise et téléchargeable au format PDF depuis l'espace client.",
        "Aucune donnée bancaire n'est collectée ni conservée par OptiSpace : le paiement est réalisé directement auprès de l'opérateur choisi.",
      ],
    },
    {
      id: "duree",
      title: "6. Durée et renouvellement",
      list: [
        "L'abonnement court pour la durée choisie à compter de son activation.",
        "Il n'est pas reconduit automatiquement : des rappels sont envoyés avant l'échéance (10, 5 et 2 jours avant), puis après.",
        "À l'échéance sans renouvellement, l'accès à l'outil est suspendu ; les données sont conservées et l'accès est rétabli dès le renouvellement.",
      ],
    },
    {
      id: "remboursement",
      title: "7. Rétractation et remboursement",
      paragraphs: [
        "Le service étant destiné aux professionnels et accessible dès son activation, [À COMPLÉTER : politique de remboursement — par exemple : aucun remboursement n'est dû pour une période entamée, sauf en cas d'indisponibilité du service imputable à OptiSpace].",
      ],
    },
    {
      id: "obligations",
      title: "8. Obligations d'OptiSpace",
      list: [
        "Fournir l'accès au service souscrit et assurer sa maintenance.",
        "Mettre en œuvre les mesures de sécurité décrites dans les CGU et n'utiliser les données du client que pour lui fournir le service.",
        "Répondre aux demandes de support depuis l'espace client.",
      ],
      after: [
        "OptiSpace s'efforce d'assurer un service disponible en continu, sans pouvoir le garantir : des interruptions peuvent survenir pour maintenance ou en raison de prestataires techniques ou de réseaux tiers.",
      ],
    },
    {
      id: "client",
      title: "9. Obligations du client",
      list: [
        "Payer l'abonnement choisi et fournir des informations exactes.",
        "Respecter les limites de son forfait et les règles d'utilisation des CGU.",
        "Vérifier les données qu'il saisit : OptiSpace calcule les montants à partir de ces saisies et ne peut être tenu responsable d'une erreur de saisie.",
      ],
    },
    {
      id: "responsabilite",
      title: "10. Responsabilité",
      paragraphs: [
        "OptiSpace est un outil d'aide à la gestion : la gestion commerciale et financière de l'activité du client reste de sa responsabilité. La responsabilité d'OptiSpace, si elle est engagée, est limitée au montant payé par le client au titre des douze derniers mois d'abonnement.",
      ],
    },
    {
      id: "resiliation",
      title: "11. Suspension et résiliation",
      list: [
        "Le client peut cesser d'utiliser le service à tout moment en ne renouvelant pas son abonnement, ou demander la suppression de son compte (voir CGU).",
        "OptiSpace peut suspendre un compte en cas de non-paiement, de fraude ou de manquement grave aux CGU.",
      ],
    },
    {
      id: "donnees",
      title: "12. Données personnelles",
      paragraphs: [
        "Les données nécessaires à la souscription (identité du gérant, coordonnées, forfait, paiements et factures) sont utilisées uniquement pour gérer l'abonnement et fournir le service, et sont protégées comme décrit dans les CGU. Elles ne sont jamais vendues ni utilisées à d'autres fins.",
      ],
    },
    {
      id: "droit",
      title: "13. Droit applicable et litiges",
      paragraphs: [
        "Les présentes CGV sont soumises au droit ivoirien. Les parties recherchent d'abord une solution amiable ; à défaut, le litige relève des juridictions compétentes d'Abidjan, Côte d'Ivoire.",
      ],
    },
  ],
};

export const LEGAL_DOCS = { cgu: CGU, cgv: CGV };
