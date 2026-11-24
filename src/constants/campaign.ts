/**
 * Fin de la campagne de l'Observatoire photo participatif des paysages parisiens.
 *
 * Prévue au 30 novembre 2026, elle a été reconduite de six mois. La date exacte reste à
 * confirmer avec le CAUE de Paris : c'est la seule valeur à modifier si elle change.
 */
export const CAMPAIGN_END_DATE = '2027-05-31';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Jours pleins restants avant la fin de la campagne (0 le dernier jour et après). */
export function campaignDaysLeft(now: Date = new Date()): number {
  const end = new Date(`${CAMPAIGN_END_DATE}T23:59:59+02:00`).getTime();
  return Math.max(0, Math.floor((end - now.getTime()) / DAY_MS));
}

export function isCampaignOpen(now: Date = new Date()): boolean {
  return now.getTime() <= new Date(`${CAMPAIGN_END_DATE}T23:59:59+02:00`).getTime();
}

/** « 31 mai 2027 » */
export function formatCampaignEnd(): string {
  return new Date(`${CAMPAIGN_END_DATE}T12:00:00+02:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
