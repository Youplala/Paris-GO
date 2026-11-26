import { BUNDLED_SNAPSHOT, type Snapshot } from '@/data/snapshot';
import { buildArchivePhotographer, isIdentifiedPhotographer } from '@/services/archive-photographers';

const snapshot = {
  archive: {
    urlTemplate: 'https://bibliotheques-specialisees.paris.fr/ark:/73873/{fonds}/{document}/v{view}',
    viewPadding: 4,
    fonds: ['FRCGMNOV-751045102-LAF'],
    metadata: [
      { author: 'Ernoult, Georges', candidateNumber: '22667', locations: ['avenue de Suffren', 'rue Péclet'] },
      { author: 'Photographe non identifié' },
      { author: 'ernoult, georges', candidateNumber: '22667', locations: ['avenue de Suffren'] },
    ],
  },
  stations: [
    {
      id: 'r1', kind: 'recapture-1970', hasRecapture: true, recaptureAuthor: 'Martin de PRESSENSÉ', recaptureDate: '2026-07-14',
      recaptureImage: 'https://example.test/r1.jpg',
      referenceImage: 'https://bibliotheques-specialisees.paris.fr/ark:/73873/FRCGMNOV-751045102-LAF/A1/v0002',
    },
    {
      id: 'r2', kind: 'recapture-1970', hasRecapture: true, recaptureAuthor: 'Martin de PRESSENSÉ', recaptureDate: '2026-07-15',
      recaptureImage: 'https://example.test/r2.jpg',
      referenceImage: 'https://bibliotheques-specialisees.paris.fr/ark:/73873/FRCGMNOV-751045102-LAF/B9/v0001',
    },
  ],
  squares: [
    { id: '13n', name: '995', coordinate: { latitude: 48.84, longitude: 2.3 }, refs: [[0, 'A1', 3, 0], [0, 'A2', 2, 1]] },
    { id: '14a', name: '1001', coordinate: { latitude: 48.85, longitude: 2.31 }, refs: [[0, 'B9', 1, 2]] },
  ],
} as unknown as Snapshot;

it('réunit toutes les vues d’un photographe, quelle que soit l’écriture de son nom', () => {
  const profile = buildArchivePhotographer(snapshot, 'Ernoult, Georges');
  expect(profile).toBeDefined();
  expect(profile?.displayName).toBe('Georges E.');
  expect(profile?.candidateNumbers).toEqual(['22667']);
  expect(profile?.photoCount).toBe(4);
  expect(profile?.recapturedCount).toBe(2);
  expect(profile?.sectors.map((sector) => [sector.squareId, sector.frames.map((frame) => frame.frameIndex)])).toEqual([
    ['13n', [0, 1, 2]],
    ['14a', [0]],
  ]);
  expect(profile?.sectors[0].frames[1].recaptures).toEqual([{ id: 'r1', author: 'Martin de PRESSENSÉ', date: '2026-07-14' }]);
  expect(profile?.streets).toEqual(['avenue de Suffren', 'rue Péclet']);
  expect(profile?.recapturedBy).toEqual([{ name: 'Martin de PRESSENSÉ', count: 2 }]);
  expect(buildArchivePhotographer(snapshot, '  ERNOULT,   Georges ')?.photoCount).toBe(4);
});

it('n’ouvre pas de profil pour une notice sans auteur', () => {
  expect(isIdentifiedPhotographer('Photographe non identifié')).toBe(false);
  expect(isIdentifiedPhotographer('Photographes non identifiés')).toBe(false);
  expect(isIdentifiedPhotographer('')).toBe(false);
  expect(buildArchivePhotographer(snapshot, 'Photographe non identifié')).toBeUndefined();
});

it('donne un profil cohérent aux photographes du relevé embarqué', () => {
  const profile = buildArchivePhotographer(BUNDLED_SNAPSHOT, 'Leblic, Jacques');
  expect(profile && profile.photoCount).toBeGreaterThan(100);
  expect(profile?.sectors.reduce((sum, sector) => sum + sector.frames.length, 0)).toBe(profile?.photoCount);
  expect(profile!.recapturedCount).toBeLessThanOrEqual(profile!.photoCount);
});
