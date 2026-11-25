import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  comparisonDimensionsForAspectRatio,
  fitAspectRatioInArea,
  photoCropForViewfinderFrame,
} from '../src/services/photo-geometry.ts';

test('portrait comparisons preserve the complete reference aspect ratio', () => {
  assert.deepEqual(comparisonDimensionsForAspectRatio(360, 9 / 16, 720), {
    width: 360,
    height: 640,
  });
});

test('landscape comparisons preserve the complete reference aspect ratio', () => {
  assert.deepEqual(comparisonDimensionsForAspectRatio(360, 3 / 2, 720), {
    width: 360,
    height: 240,
  });
});

test('very tall comparisons shrink their width instead of cropping or allocating unbounded height', () => {
  assert.deepEqual(comparisonDimensionsForAspectRatio(360, 1 / 3, 720), {
    width: 240,
    height: 720,
  });
});

test('malformed comparison ratios use safe fallback dimensions', () => {
  assert.deepEqual(comparisonDimensionsForAspectRatio(360, 0.001, 720, 280), {
    width: 360,
    height: 280,
  });
  assert.deepEqual(comparisonDimensionsForAspectRatio(0, 9 / 16, 720, 280), {
    width: 0,
    height: 280,
  });
});

test('capture and review screens do not expose the decorative angle meter', async () => {
  const [alignment, review, appConfig] = await Promise.all([
    readFile(new URL('../src/screens/alignment/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/screens/review/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app.json', import.meta.url), 'utf8'),
  ]);

  for (const source of [alignment, review]) {
    assert.doesNotMatch(source, /useDeviceAttitude|rollDegrees|pitchDegrees/);
  }
  assert.doesNotMatch(alignment, /NIVEAU/);
  assert.doesNotMatch(review, /PENCHÉ|APPAREIL DROIT|Tenue de l’appareil/);
  assert.doesNotMatch(appConfig, /expo-sensors|motionPermission/);
});

test('the viewfinder frame takes the largest archive-shaped rectangle in the free area', () => {
  assert.deepEqual(fitAspectRatioInArea({ left: 0, top: 100, width: 390, height: 600 }, 3 / 4), {
    left: 0,
    top: 140,
    width: 390,
    height: 520,
  });
  assert.deepEqual(fitAspectRatioInArea({ left: 60, top: 8, width: 600, height: 300 }, 3 / 2), {
    left: 135,
    top: 8,
    width: 450,
    height: 300,
  });
  assert.deepEqual(fitAspectRatioInArea({ left: 0, top: 0, width: 0, height: 300 }, 1), {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
});

test('the saved photo keeps exactly what the full-screen preview showed inside the frame', () => {
  // Capteur 3:4 affiché en « cover » sur un écran 390×844 : il déborde à gauche et à droite.
  const crop = photoCropForViewfinderFrame({
    photoWidth: 3024,
    photoHeight: 4032,
    viewWidth: 390,
    viewHeight: 844,
    frame: { left: 0, top: 140, width: 390, height: 520 },
  });
  const scale = 844 / 4032;
  const offsetX = (390 - 3024 * scale) / 2;
  assert.deepEqual(crop, {
    left: Math.round(-offsetX / scale),
    top: Math.round(140 / scale),
    width: Math.round(390 / scale),
    height: Math.round(520 / scale),
  });
  assert.ok(Math.abs(crop.width / crop.height - 3 / 4) < 0.002);
});

test('the viewfinder crop stays inside the photo and rejects unusable measurements', () => {
  const crop = photoCropForViewfinderFrame({
    photoWidth: 4032,
    photoHeight: 3024,
    viewWidth: 844,
    viewHeight: 390,
    frame: { left: 0, top: 0, width: 844, height: 390 },
  });
  assert.ok(crop.left >= 0 && crop.top >= 0);
  assert.ok(crop.left + crop.width <= 4032 && crop.top + crop.height <= 3024);
  assert.equal(
    photoCropForViewfinderFrame({
      photoWidth: 4032,
      photoHeight: 3024,
      viewWidth: 0,
      viewHeight: 390,
      frame: { left: 0, top: 0, width: 100, height: 100 },
    }),
    undefined,
  );
});

test('the viewfinder zooms the camera with a pinch and moves the archive with two fingers', async () => {
  const alignment = await readFile(
    new URL('../src/screens/alignment/index.tsx', import.meta.url),
    'utf8',
  );
  assert.match(alignment, /Gesture\.Pinch\(\)/);
  assert.match(alignment, /\.minPointers\(2\)/);
  assert.match(alignment, /cameraZoomValue\.value = Math\.max\(0, Math\.min\(MAX_CAMERA_ZOOM/);
  assert.match(alignment, /photoCropForViewfinderFrame\(/);
  assert.doesNotMatch(alignment, /accessibilityLabel="Zoom de la caméra"/);
});
