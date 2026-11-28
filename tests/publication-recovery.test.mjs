import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const privacyFiles = ['docs/CONFIDENTIALITE.md', 'site/confidentialite/index.html'];
const reviewFiles = [
  'docs/app-review/README.md',
  'docs/app-review/REPONSE-APP-STORE-CONNECT.md',
  'docs/app-review/SCRIPT-ENREGISTREMENT.md',
];

test('la documentation ne promet plus les repères ni la collecte du capteur retiré', () => {
  for (const file of [...privacyFiles, 'docs/PUBLICATION.md', 'store.config.json', 'site/index.html', ...reviewFiles]) {
    const text = read(file);
    assert.doesNotMatch(text, /repères d’inclinaison|tilt guides|motion permission used for|l’orientation du téléphone|la caméra et l’orientation/, file);
  }
});

test('les documents décrivent le formulaire durable et l’identité mémorisée sur choix explicite', () => {
  for (const file of [...privacyFiles, 'docs/PUBLICATION.md', 'docs/app-review/MAIL-CAUE.md', 'docs/app-review/REPONSE-APP-STORE-CONNECT.md']) {
    const text = read(file);
    assert.match(text, /https:\/\/opppp\.cartes\.xyz\/elements\/add/, file);
    assert.doesNotMatch(text, /never fills identity|never fills identity fields|ne renseigne jamais l.identité/, file);
    assert.match(text, /choix explicite|explicit opt-in/, file);
  }
});

test('les conditions et les explications publiques incluent l’identité facultative', () => {
  for (const file of ['site/conditions/index.html', 'site/support/index.html', 'site/index.html']) {
    const text = read(file);
    assert.doesNotMatch(text, /ne renseigne pas votre identité/);
    assert.match(text, /choix explicite de mémorisation/, file);
  }
});

test('le dossier App Review reste une préparation sans preuve de candidat ni autorisation inventée', () => {
  for (const file of reviewFiles) {
    const text = read(file);
    assert.match(text, /À compléter avant envoi/, file);
    assert.doesNotMatch(text, /1\.0\.0 \((?:11|12)\)|Please review build 11|We have also uploaded a new build|Attached: a screen recording made on|iOS \[26|Il est en\s+26\.4\.2/, file);
  }
  const response = read('docs/app-review/REPONSE-APP-STORE-CONNECT.md');
  assert.match(response, /NSMotionUsageDescription/);
  assert.match(response, /autorisation écrite.*BHVP.*manquante/);
  assert.match(response, /Ne pas coller.*Notes/);
});
