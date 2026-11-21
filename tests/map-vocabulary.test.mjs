import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = [
  'src/screens/map/index.tsx',
  'src/components/station-card.tsx',
  'src/components/paris-grid-map.tsx',
  'src/screens/collective/index.tsx',
  'src/screens/coverage/index.tsx',
  'src/screens/contributors/index.tsx',
  'src/screens/contributor/index.tsx',
  'src/utils/place-name.ts',
];

test('le vocabulaire commun est appliqué aux écrans carte et communauté', async () => {
  for (const file of files) {
    const full = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    const source = full
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
      .join('\n');
    assert.doesNotMatch(source, /Secteur \$\{|Secteur \d|À LOCALISER|À CONTINUER|SECTEUR COMPLÉTÉ/, file);
    assert.doesNotMatch(source, /à retrouver|[Cc]ontributeurs?/, file);
  }
});

test('la carte a des boutons flottants distincts via IconButton', async () => {
  const source = await readFile(new URL('../src/screens/map/index.tsx', import.meta.url), 'utf8');
  assert.match(source, /Orienter la carte vers le nord/);
  assert.match(source, /Me localiser/);
  assert.match(source, /<IconButton/);
});
