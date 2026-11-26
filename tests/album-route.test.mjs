import assert from 'node:assert/strict';
import test from 'node:test';

import { dottedPath, groupRouteStops, partialRoute, projectOnSquare, squareRegionFor } from '../src/services/album-route.ts';

const a = { latitude: 48.8566, longitude: 2.3522 };
const b = { latitude: 48.8576, longitude: 2.3522 };
const c = { latitude: 48.8576, longitude: 2.3542 };

test('les reprises faites au même endroit partagent un repère numéroté', () => {
  const stops = groupRouteStops([
    { ...a, index: 0 },
    { latitude: a.latitude + 0.0001, longitude: a.longitude, index: 1 },
    { ...c, index: 2 },
    { ...a, index: 3 },
  ]);
  assert.deepEqual(stops.map((stop) => stop.label), ['1·2·4', '3']);
  assert.deepEqual(stops[0].steps, [0, 1, 3]);
});

test('le tracé avance segment par segment', () => {
  assert.deepEqual(partialRoute([a, b, c], 0), [a, a]);
  assert.deepEqual(partialRoute([a, b, c], 1), [a, b, c]);
  const half = partialRoute([a, b, c], 0.75);
  assert.equal(half.length, 3);
  assert.deepEqual(half.slice(0, 2), [a, b]);
  assert.ok(Math.abs(half[2].longitude - 2.3532) < 1e-9);
  assert.deepEqual(partialRoute([a], 0.5), [a]);
});

test('la carte partagée contient tout le tracé, au centre d’un carré', () => {
  const region = squareRegionFor([a, b, c]);
  assert.ok(region);
  const points = [a, b, c].map((point) => projectOnSquare(point, region, 360));
  for (const { x, y } of points) {
    assert.ok(x > 0 && x < 360 && y > 0 && y < 360, `${x},${y} dans l’image`);
  }
  // Le nord est en haut, l'est à droite.
  assert.ok(points[1].y < points[0].y);
  assert.ok(points[2].x > points[1].x);
  assert.equal(squareRegionFor([]), undefined);
  const single = squareRegionFor([a]);
  assert.ok(single && single.latitudeDelta > 0 && single.longitudeDelta > 0);
});

test('le pointillé suit le tracé à intervalle régulier', () => {
  const dots = dottedPath([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }], 10);
  assert.deepEqual(dots[0], { x: 0, y: 0 });
  assert.deepEqual(dots.at(-1), { x: 30, y: 20 });
  assert.equal(dots.length, 6);
});
