import assert from 'node:assert/strict';
import test from 'node:test';

import {
  albumDayKey,
  albumPlaces,
  albumStats,
  defaultAlbumTitle,
  findAlbum,
  formatAlbumDay,
  formatWalkDistance,
  groupCapturesIntoAlbums,
  placeLabel,
  summarizePlaces,
  walkDistanceMeters,
} from '../src/services/albums.ts';
import { createAlbumTitleStore, normalizeAlbumTitle, ALBUM_TITLES_KEY } from '../src/services/album-titles.ts';

const capture = (id, createdAt, extra = {}) => ({
  schemaVersion: 2,
  id,
  stationId: extra.stationId ?? '13n',
  stationName: extra.stationName ?? '995',
  frameIndex: 0,
  imageUri: `file:///captures/${id}.jpg`,
  simulated: false,
  preparation: { current: { ready: false }, reference: { ready: false } },
  createdAt,
  ...extra,
});

test('une balade regroupe les reprises du même jour à Paris, la plus récente d’abord', () => {
  const albums = groupCapturesIntoAlbums([
    capture('b', '2026-07-14T15:10:00Z'),
    capture('a', '2026-07-14T09:00:00Z'),
    // 21 h 30 UTC : 23 h 30 à Paris, encore le 14 juillet.
    capture('c', '2026-07-14T21:30:00Z'),
    // 00 h 30 à Paris le 22 juin, encore le 21 en UTC.
    capture('d', '2026-06-21T22:30:00Z'),
  ]);
  assert.deepEqual(albums.map((album) => album.id), ['2026-07-14', '2026-06-22']);
  assert.deepEqual(albums[0].captures.map((item) => item.id), ['a', 'b', 'c']);
  assert.equal(albums[0].startedAt, '2026-07-14T09:00:00Z');
  assert.equal(albums[0].endedAt, '2026-07-14T21:30:00Z');
  assert.equal(findAlbum([capture('a', '2026-07-14T09:00:00Z')], '2026-07-14')?.captures.length, 1);
  assert.equal(findAlbum([], '2026-07-14'), undefined);
});

test('les démonstrations et les reprises sans photo ne forment pas d’album', () => {
  assert.deepEqual(groupCapturesIntoAlbums([
    capture('demo', '2026-07-14T09:00:00Z', { simulated: true }),
    capture('vide', '2026-07-14T09:00:00Z', { imageUri: undefined }),
    capture('date', 'pas une date'),
  ]), []);
  assert.equal(albumDayKey('pas une date'), undefined);
});

test('la distance relie les reprises dans l’ordre et ignore celles sans position', () => {
  const route = [
    { latitude: 48.8566, longitude: 2.3522 },
    undefined,
    { latitude: 48.8656, longitude: 2.3522 },
  ];
  const meters = walkDistanceMeters(route);
  assert.ok(meters > 990 && meters < 1010, `≈ 1 km, obtenu ${meters}`);
  assert.equal(walkDistanceMeters([route[0]]), 0);
  assert.equal(formatWalkDistance(meters), '1,0 km');
  assert.equal(formatWalkDistance(2430), '2,4 km');
  assert.equal(formatWalkDistance(12_600), '13 km');
  assert.equal(formatWalkDistance(830), '850 m');
  assert.equal(formatWalkDistance(60), undefined);
});

test('les chiffres d’une balade comptent les reprises, les lieux et le tracé', () => {
  const [album] = groupCapturesIntoAlbums([
    capture('a', '2026-07-14T09:00:00Z', { coordinate: { latitude: 48.8566, longitude: 2.3522 } }),
    capture('b', '2026-07-14T10:00:00Z', { coordinate: { latitude: 48.8656, longitude: 2.3522 } }),
    capture('c', '2026-07-14T11:00:00Z', { stationId: '42', stationName: 'Rue Mouffetard' }),
  ]);
  assert.deepEqual(albumStats(album), { count: 3, places: 2, distance: '1,0 km', hasRoute: true });
  assert.deepEqual(
    albumPlaces(album, (item) => placeLabel(item, item.stationId === '13n')),
    ['Secteur 995', 'Rue Mouffetard'],
  );
});

test('titres et dates se lisent en français', () => {
  const now = new Date('2026-11-26T10:00:00Z');
  assert.equal(defaultAlbumTitle({ id: '2026-07-14' }, now), 'Balade du 14 juillet');
  assert.equal(defaultAlbumTitle({ id: '2026-05-01' }, now), 'Balade du 1er mai');
  assert.equal(defaultAlbumTitle({ id: '2025-06-21' }, now), 'Balade du 21 juin 2025');
  assert.equal(formatAlbumDay('2026-07-14'), 'Mardi 14 juillet 2026');
  assert.equal(summarizePlaces([]), '');
  assert.equal(summarizePlaces(['Secteur 995']), 'Secteur 995');
  assert.equal(summarizePlaces(['Secteur 995', 'Rue Mouffetard']), 'Secteur 995 et 1 autre lieu');
  assert.equal(summarizePlaces(['A', 'B', 'C']), 'A et 2 autres lieux');
  assert.equal(placeLabel({ stationId: '7', stationName: undefined }, false), 'Point 7');
  assert.equal(placeLabel({ stationId: '7', stationName: '12' }, false), '12');
});

test('les titres choisis sont mémorisés, nettoyés, et un titre vide rend le titre par défaut', async () => {
  const memory = new Map();
  const storage = {
    getItem: async (key) => memory.get(key) ?? null,
    setItem: async (key, value) => { memory.set(key, value); },
  };
  const store = createAlbumTitleStore(storage);
  assert.deepEqual(await store.list(), {});
  await store.rename('2026-07-14', '  Autour   du Champ-de-Mars ');
  assert.deepEqual(await store.list(), { '2026-07-14': 'Autour du Champ-de-Mars' });
  await store.rename('2026-07-14', '   ');
  assert.deepEqual(await store.list(), {});
  assert.equal(normalizeAlbumTitle('x'.repeat(80)).length, 60);

  memory.set(ALBUM_TITLES_KEY, '{"pas-un-jour":"x","2026-01-02":3,"2026-01-03":"Ok"}');
  assert.deepEqual(await store.list(), { '2026-01-03': 'Ok' });
  memory.set(ALBUM_TITLES_KEY, 'cassé');
  assert.deepEqual(await store.list(), {});
});
