export type FilmstripFilter = 'all' | 'done';

/** Indices des vignettes à montrer : toutes, ou seulement les photos déjà refaites. */
export function filmstripIndices(
  recaptureCounts: readonly number[],
  filter: FilmstripFilter,
): number[] {
  return recaptureCounts.flatMap((count, index) => (filter === 'all' || count > 0 ? [index] : []));
}

/** « 9 refaites sur 32 », « 1 refaite sur 32 ». */
export function recapturedProgressLabel(done: number, total: number) {
  return `${done} ${done > 1 ? 'refaites' : 'refaite'} sur ${total}`;
}

const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

/** « 2026-03-14 » → « mars 2026 » ; une date illisible garde son année si elle en a une. */
export function formatRecaptureMonth(isoDate?: string) {
  if (!isoDate) return undefined;
  const date = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (!Number.isNaN(date.getTime())) return monthFormat.format(date);
  const year = isoDate.match(/\d{4}/)?.[0];
  return year;
}

/** « Camille Dupont » → « CD », pour la pastille de l'auteur. */
export function contributorInitials(name?: string) {
  const words = (name ?? '').trim().split(/[\s.-]+/).filter(Boolean);
  if (!words.length) return '?';
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase('fr-FR'))
    .join('');
}
