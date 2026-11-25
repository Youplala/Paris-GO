import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contributorInitials,
  filmstripIndices,
  formatRecaptureMonth,
  recapturedProgressLabel,
} from '../src/utils/archive-frames.ts';

test('le filtre « Refaites » ne garde que les photos refaites, dans l’ordre de la planche', () => {
  assert.deepEqual(filmstripIndices([0, 2, 0, 1], 'all'), [0, 1, 2, 3]);
  assert.deepEqual(filmstripIndices([0, 2, 0, 1], 'done'), [1, 3]);
  assert.deepEqual(filmstripIndices([0, 0], 'done'), []);
});

test('la progression du secteur parle de photos refaites, au singulier comme au pluriel', () => {
  assert.equal(recapturedProgressLabel(9, 32), '9 refaites sur 32');
  assert.equal(recapturedProgressLabel(1, 32), '1 refaite sur 32');
  assert.equal(recapturedProgressLabel(0, 32), '0 refaite sur 32');
});

test('la date d’une reprise se lit en mois et année', () => {
  assert.equal(formatRecaptureMonth('2026-03-14'), 'mars 2026');
  assert.equal(formatRecaptureMonth('2026-11-02T08:30:00Z'), 'novembre 2026');
  assert.equal(formatRecaptureMonth('vers 2026'), '2026');
  assert.equal(formatRecaptureMonth(undefined), undefined);
});

test('la pastille de l’auteur prend ses initiales', () => {
  assert.equal(contributorInitials('Camille D.'), 'CD');
  assert.equal(contributorInitials('jean-paul sartre'), 'JP');
  assert.equal(contributorInitials('  '), '?');
  assert.equal(contributorInitials(undefined), '?');
});
