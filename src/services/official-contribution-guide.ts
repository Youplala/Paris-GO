/**
 * Le mode d'emploi du formulaire officiel, sur un seul écran : ce que Paris GO prépare, ce que
 * la personne fait elle-même, et ce qui se passe ensuite. Court, mais honnête sur le partage
 * des rôles : l'identité, le règlement et l'envoi restent entre ses mains.
 */
export const OFFICIAL_CONTRIBUTION_GUIDE = {
  title: 'Envoyer votre photo à l’Observatoire',
  steps: [
    {
      text: 'Vos deux photos, l’adresse et la date sont déjà remplies.',
      note: 'La photo de 1970 d’abord, votre photo actuelle ensuite. Le commentaire mentionnera « Photo refaite avec Paris GO ».',
    },
    {
      text: 'Vous indiquez votre nom et votre e‑mail, puis acceptez le règlement.',
    },
    {
      text: 'Vous appuyez sur Envoyer. L’Observatoire vérifie votre photo avant de la publier (modération).',
    },
  ],
  action: 'C’est parti',
} as const;
