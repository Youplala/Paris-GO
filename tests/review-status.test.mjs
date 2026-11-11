import assert from 'node:assert/strict';
import test from 'node:test';

import { getLocationNotice, getSaveStatus } from '../src/services/review-status.ts';

test('une position précise ne produit aucun message', () => {
  assert.equal(
    getLocationNotice({
      simulated: false,
      location: { latitude: 48.86, longitude: 2.34, precision: 'precise' },
    }),
    undefined,
  );
});

test('une position approximative ou absente est signalée à l’utilisateur', () => {
  const approximate = getLocationNotice({
    simulated: false,
    location: { latitude: 48.86, longitude: 2.34, precision: 'approximate' },
  });
  assert.match(approximate.message, /Position approximative/);
  const missing = getLocationNotice({ simulated: false });
  assert.match(missing.message, /Position non enregistrée/);
  assert.equal(missing.icon, 'exclamationmark.circle.fill');
});

test('le simulateur ne revendique aucune position', () => {
  assert.equal(getLocationNotice({ simulated: true }), undefined);
});

test('le statut d’enregistrement suit la sauvegarde automatique', () => {
  const base = { simulated: false, saving: false, saved: false, savedToLibrary: false, failed: false };
  assert.equal(getSaveStatus({ ...base, saving: true }).tone, 'progress');
  const done = getSaveStatus({ ...base, saved: true, savedToLibrary: true });
  assert.equal(done.tone, 'done');
  assert.match(done.message, /Mes photos/);
  assert.match(done.message, /Photos \(Récents\)/);
  const noLibrary = getSaveStatus({ ...base, saved: true });
  assert.match(noLibrary.message, /n’a pas abouti/);
  assert.equal(getSaveStatus({ ...base, failed: true }).tone, 'error');
});

test('le simulateur ne prétend pas avoir créé de photo', () => {
  const status = getSaveStatus({
    simulated: true, saving: false, saved: true, savedToLibrary: false, failed: false,
  });
  assert.match(status.message, /Aucune photo créée/);
  assert.doesNotMatch(status.message, /Photos \(Récents\)/);
});

test('aucun jargon technique ni mot banni dans les messages', () => {
  const base = { simulated: false, saving: false, saved: true, savedToLibrary: true, failed: false };
  const copy = [
    getSaveStatus(base).message,
    getLocationNotice({ simulated: false }).message,
  ].join(' ');
  assert.doesNotMatch(copy, /carnet|dépôt|capture|JPEG|réencodé/i);
});
