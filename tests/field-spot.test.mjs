import assert from 'node:assert/strict';
import test from 'node:test';

import {
  distanceMeters,
  formatDistance,
  spotProximity,
  walkingDirectionsUrls,
} from '../src/services/field-spot.ts';

const bounds = [2.34, 48.85, 2.343, 48.852];
const center = { latitude: 48.851, longitude: 2.3415 };

test('la distance est cohérente à Paris', () => {
  const meters = distanceMeters(center, { latitude: 48.852, longitude: 2.3415 });
  assert.ok(meters > 105 && meters < 118, String(meters));
});

test('dans le carré ou à moins de 150 m, on est dans la zone', () => {
  assert.equal(spotProximity(center, center, bounds).inZone, true);
  const near = { latitude: 48.8530, longitude: 2.3415 };
  assert.equal(spotProximity(near, center, bounds).inZone, true);
  const far = { latitude: 48.86, longitude: 2.3415 };
  assert.equal(spotProximity(far, center, bounds).inZone, false);
});

test('sans carré, la zone se mesure autour du point', () => {
  assert.equal(spotProximity(center, center).inZone, true);
  assert.equal(spotProximity({ latitude: 48.86, longitude: 2.34 }, center).inZone, false);
});

test('la distance est lisible', () => {
  assert.equal(formatDistance(4), '10 m');
  assert.equal(formatDistance(347), '350 m');
  assert.equal(formatDistance(1540), '1,5 km');
  assert.equal(formatDistance(12400), '12 km');
});

test('les itinéraires à pied ciblent Plans sur iOS et Google/geo sur Android', () => {
  assert.deepEqual(walkingDirectionsUrls({ latitude: 48.85, longitude: 2.34 }, 'ios'), [
    'http://maps.apple.com/?daddr=48.85,2.34&dirflg=w',
  ]);
  const android = walkingDirectionsUrls({ latitude: 48.85, longitude: 2.34 }, 'android');
  assert.match(android[0], /^google\.navigation:/);
  assert.match(android[1], /^geo:/);
});

test('le viseur garde ses garanties : pas d’EXIF, mode démo, paramètres de revue', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/screens/alignment/index.tsx', import.meta.url), 'utf8');
  assert.match(src, /takePictureAsync\(\{ quality: 1, exif: false \}\)/);
  assert.match(src, /MODE DÉMO/);
  assert.match(src, /ScreenOrientation\.unlockAsync/);
  for (const key of ['frame', 'referenceUri', 'uri', 'simulated', 'latitude', 'longitude', 'locationPrecision']) {
    assert.match(src, new RegExp(`${key}:`));
  }
  assert.doesNotMatch(src, /CAMÉRA ACTIVE|Contraste|ZOOM|formatBadge/);
});
