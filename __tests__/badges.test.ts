import { computeBadges } from '@/services/badges';
import type { SavedCapture } from '@/services/fieldbook-store';

const capture = (id: string, stationId: string, frameIndex: number, simulated = false) =>
  ({ id, stationId, frameIndex, simulated, createdAt: '2026-07-14T10:00:00Z' }) as SavedCapture;

const frames: Record<string, number> = { '13n': 3, '14a': 32 };
const frameCountFor = (id: string) => frames[id];

it('verrouille tout sur un carnet vide', () => {
  const badges = computeBadges([], frameCountFor);
  expect(badges.map((badge) => [badge.id, badge.unlocked, badge.progress])).toEqual([
    ['first', false, '0/1'],
    ['ten', false, '0/10'],
    ['sector', false, undefined],
  ]);
});

it('débloque la première reprise, compte vers dix, et suit le secteur le plus avancé', () => {
  const badges = computeBadges(
    [capture('a', '14a', 0), capture('b', '13n', 0), capture('c', '13n', 1), capture('d', '13n', 1), capture('demo', '13n', 2, true)],
    frameCountFor,
  );
  expect(badges[0]).toMatchObject({ unlocked: true, progress: undefined });
  expect(badges[1]).toMatchObject({ unlocked: false, progress: '4/10' });
  expect(badges[2]).toMatchObject({ unlocked: false, progress: '2/3' });
});

it('débloque « secteur complété » quand toutes ses vues sont refaites', () => {
  const badges = computeBadges([capture('a', '13n', 0), capture('b', '13n', 1), capture('c', '13n', 2)], frameCountFor);
  expect(badges[2]).toMatchObject({ unlocked: true, progress: undefined });
});
