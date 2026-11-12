import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { trySetLocationPreference } from '../src/services/location-preference.ts';
import { onboardingImageSource } from '../src/services/onboarding-images.ts';
import {
  HISTORIC_GRID_COUNT,
  LOCATION_PRIVACY_COPY,
} from '../src/services/onboarding.ts';

test('présente le nombre historique officiel de carrés du concours', () => {
  assert.equal(HISTORIC_GRID_COUNT, 1755);
});

test('allège les deux photos d’accueil sur le CDN existant sans confondre leurs sources', () => {
  const before = { uri: 'https://i0.wp.com/observatoire-photo.paris/uploads/1970.jpg?ssl=1' };
  const after = { uri: 'https://i0.wp.com/observatoire-photo.paris/uploads/2026.jpg?ssl=1' };
  const a = new URL(onboardingImageSource(before).uri);
  const b = new URL(onboardingImageSource(after).uri);
  assert.notEqual(a.pathname, b.pathname);
  for (const url of [a, b]) {
    assert.equal(url.origin, 'https://i0.wp.com');
    assert.equal(url.searchParams.get('w'), '1200');
    assert.equal(url.searchParams.get('quality'), '85');
    assert.equal(url.searchParams.get('ssl'), '1');
  }
});

test('réduit les vignettes du radar à la largeur demandée', () => {
  const thumb = { uri: 'https://i0.wp.com/observatoire-photo.paris/uploads/1970.jpg?ssl=1' };
  const url = new URL(onboardingImageSource(thumb, 240).uri);
  assert.equal(url.searchParams.get('w'), '240');
  assert.equal(url.searchParams.get('ssl'), '1');
});

test('les vignettes du radar passent par le CDN redimensionné', () => {
  const source = fs.readFileSync(new URL('../src/screens/onboarding/index.tsx', import.meta.url), 'utf8');
  assert.match(source, /\.map\(\(image\) => onboardingImageSource\(image, 240\)\)/);
});

test('ne redirige pas les images locales ou d’autres domaines vers le CDN', () => {
  for (const source of [
    { uri: 'file:///private/capture.jpg' },
    { uri: 'https://example.test/photo.jpg' },
    { uri: 'https://i0.wp.com/example.test/photo.jpg' },
    { uri: 'invalid' },
    {},
  ]) assert.equal(onboardingImageSource(source), source);
});

test('ne présente plus l’ancien sous-ensemble importé comme la grille historique complète', () => {
  for (const relativePath of [
    '../README.md',
    '../docs/PUBLICATION.md',
    '../src/screens/coverage/index.tsx',
  ]) {
    const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /1[ . ]171/);
  }
});

test('décrit honnêtement le traitement local et volontaire des coordonnées', () => {
  assert.match(LOCATION_PRIVACY_COPY, /enregistrées dans votre carnet/);
  assert.match(LOCATION_PRIVACY_COPY, /formulaire officiel/);
  assert.match(LOCATION_PRIVACY_COPY, /jamais envoyées sans votre validation/);
  assert.doesNotMatch(LOCATION_PRIVACY_COPY, /ni enregistrée, ni publiée/);
});

test('une panne du stockage de préférence ne bloque pas la sortie de l’onboarding', async () => {
  const saved = await trySetLocationPreference('manual', async () => {
    throw new Error('storage unavailable');
  });

  assert.equal(saved, false);
});

test('confirme une préférence écrite normalement', async () => {
  let received;
  const saved = await trySetLocationPreference('nearby', async (preference) => {
    received = preference;
  });

  assert.equal(saved, true);
  assert.equal(received, 'nearby');
});
