import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

import { ANDROID_SYMBOLS } from '../src/constants/android-symbols.ts';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const materialSymbols = JSON.parse(
  readFileSync(join(root, 'node_modules/expo-symbols/build/android/symbols.json'), 'utf8'),
);
const sfSymbols = new Set(
  [...readFileSync(join(root, 'node_modules/sf-symbols-typescript/dist/index.d.ts'), 'utf8')
    .matchAll(/'([a-z0-9][a-z0-9.]*)'/g)].map((match) => match[1]),
);

// Chaînes du code qui coïncident avec un nom SF Symbol sans désigner d'icône (styles, champs de
// formulaire, clés internes). Toute autre chaîne de ce genre doit avoir son équivalent Android.
const NON_ICON_WORDS = new Set([
  'bold', 'capsule', 'circle', 'clear', 'display', 'grid', 'italic', 'key', 'left', 'mail',
  'note', 'radio', 'right', 'smartphone', 'square', 'stop', 'underline',
]);

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.web\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const files = sourceFiles(join(root, 'src')).filter((file) => !file.endsWith('android-symbols.ts'));

test('chaque équivalent Android est un vrai glyphe Material Symbols', () => {
  for (const [sf, material] of Object.entries(ANDROID_SYMBOLS)) {
    assert.ok(material in materialSymbols, `${sf} → ${material} n'existe pas dans Material Symbols`);
  }
});

test('chaque SF Symbol utilisé par l’app a un équivalent Android', () => {
  const missing = new Set();
  for (const file of files) {
    // `md="…"` nomme déjà un glyphe Material (icônes d'onglets) : rien à traduire.
    for (const [, md, name] of readFileSync(file, 'utf8').matchAll(/(md=)?['"]([a-z0-9][a-z0-9.]*)['"]/g)) {
      if (!md && sfSymbols.has(name) && !NON_ICON_WORDS.has(name) && !(name in ANDROID_SYMBOLS)) {
        missing.add(`${name} (${relative(root, file)})`);
      }
    }
  }
  assert.deepEqual([...missing], []);
});

test('les écrans passent par le SymbolView qui traduit les noms pour Android', () => {
  const direct = files
    .filter((file) => !/[\\/]components[\\/]ui[\\/]symbol(\.android)?\.tsx$/.test(file))
    .filter((file) => /import\s*\{[^}]*\bSymbolView\b[^}]*\}\s*from\s*'expo-symbols'/.test(readFileSync(file, 'utf8')))
    .map((file) => relative(root, file));
  assert.deepEqual(direct, []);
});

test('la barre flottante d’Android déclare les mêmes onglets que la barre native d’iOS', () => {
  const routes = readdirSync(join(root, 'src/app/(tabs)'))
    .filter((file) => file.endsWith('.tsx') && !file.startsWith('_'))
    .map((file) => file.replace(/\.tsx$/, ''))
    .sort();
  const ios = readFileSync(join(root, 'src/components/app-tabs.tsx'), 'utf8');
  const android = readFileSync(join(root, 'src/components/app-tabs.android.tsx'), 'utf8');
  const iosTabs = [...ios.matchAll(/<NativeTabs\.Trigger name="([^"]+)"/g)].map((m) => m[1]);
  const androidTabs = [...android.matchAll(/\{ name: '([^']+)', label: '[^']+', icon: '[^']+' \}/g)].map((m) => m[1]);
  assert.deepEqual([...iosTabs].sort(), routes);
  assert.deepEqual(androidTabs, iosTabs);
});
