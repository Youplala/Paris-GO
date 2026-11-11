import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const review = read('../src/screens/review/index.tsx');
const official = read('../src/screens/official-submission/index.tsx');

test('la review enregistre automatiquement une seule fois, sans bouton d’enregistrement', () => {
  assert.match(review, /autoSaveStarted\.current/);
  assert.match(review, /resumed === '1' \|\| Boolean\(captureId\)/);
  assert.doesNotMatch(review, /Enregistrer ma photo/);
  assert.doesNotMatch(review, /CONTRÔLE AVANT DÉPÔT|Préparer le dépôt officiel/);
  assert.match(review, /Réessayer l’enregistrement/);
});

test('la review propose un seul appel à l’action et un report', () => {
  assert.match(review, /label="Envoyer à l’Observatoire"/);
  assert.match(review, /Plus tard/);
  assert.match(review, /Mes photos/);
  assert.match(review, /<BeforeAfterSlider/);
});

test('l’écran d’envoi n’ouvre plus le guide automatiquement', () => {
  assert.doesNotMatch(official, /shouldShowOfficialContributionGuide/);
  assert.match(official, /Envoyer ma photo/);
});

test('la réussite marque la photo envoyée une seule fois, jamais en test local ni en démo', () => {
  assert.match(official, /successHandled\.current/);
  assert.match(
    official,
    /!OFFICIAL_SUBMISSION_FIXTURE_ENABLED && !isSimulated && captureId[\s\S]*markCaptureSubmitted\(captureId\)/,
  );
  assert.equal((official.match(/markCaptureSubmitted\(/g) ?? []).length, 1);
  assert.match(official, /Photo envoyée/);
  assert.match(official, /Elle sera publiée après validation par l’Observatoire\./);
  assert.match(official, /router\.replace\('\/photos' as never\)/);
});

test('la confiance reste affichée : Paris GO ne reçoit rien', () => {
  assert.match(official, /Paris GO ne reçoit rien/);
});
