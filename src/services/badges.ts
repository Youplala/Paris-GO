import type { SavedCapture } from '@/services/fieldbook-store';

export type BadgeId = 'first' | 'ten' | 'sector';

export type Badge = {
  id: BadgeId;
  title: string;
  unlocked: boolean;
  /** « 3/10 », ou rien une fois débloqué. */
  progress?: string;
  hint: string;
};

/** Nombre de vues d'un secteur, pour savoir s'il a été entièrement refait. */
type FrameCountFor = (stationId: string) => number | undefined;

/**
 * Les récompenses du carnet, calculées à partir des seules reprises de l'appareil : la première,
 * la dixième, et un secteur dont toutes les photos de 1970 ont été refaites.
 */
export function computeBadges(captures: readonly SavedCapture[], frameCountFor: FrameCountFor): Badge[] {
  const real = captures.filter((capture) => !capture.simulated);
  const count = real.length;

  const framesBySector = new Map<string, Set<number>>();
  for (const capture of real) {
    const frames = framesBySector.get(capture.stationId) ?? new Set<number>();
    frames.add(capture.frameIndex);
    framesBySector.set(capture.stationId, frames);
  }
  let best: { done: number; total: number } | undefined;
  for (const [stationId, frames] of framesBySector) {
    const total = frameCountFor(stationId);
    if (!total) continue;
    const done = Math.min(frames.size, total);
    if (!best || done / total > best.done / best.total) best = { done, total };
  }
  const sectorDone = Boolean(best && best.done >= best.total);

  return [
    {
      id: 'first',
      title: 'Première reprise',
      unlocked: count >= 1,
      progress: count >= 1 ? undefined : '0/1',
      hint: 'Refaire une première photo de 1970.',
    },
    {
      id: 'ten',
      title: '10 reprises',
      unlocked: count >= 10,
      progress: count >= 10 ? undefined : `${count}/10`,
      hint: 'Refaire dix photos, où vous voulez.',
    },
    {
      id: 'sector',
      title: 'Secteur complété',
      unlocked: sectorDone,
      progress: sectorDone ? undefined : best ? `${best.done}/${best.total}` : undefined,
      hint: 'Refaire toutes les photos d’un même secteur.',
    },
  ];
}
