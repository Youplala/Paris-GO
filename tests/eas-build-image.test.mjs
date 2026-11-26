import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const eas = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));

// App Store Connect refuse à partir d'avril 2027 les binaires compilés avec un SDK antérieur à
// iOS 27 (ITMS-90725). L'image EAS doit donc embarquer Xcode 27 ou plus récent, et pas une RC.
test('chaque profil iOS compile avec une image Xcode 27 ou plus récente', () => {
  for (const [name, profile] of Object.entries(eas.build)) {
    const image = profile.ios?.image;
    assert.ok(image, `le profil ${name} doit fixer son image iOS`);
    const match = /xcode-(\d+)\.(\d+)$/.exec(image);
    assert.ok(match, `${name} : image inattendue ${image}`);
    assert.ok(Number(match[1]) >= 27, `${name} : ${image} compile avec un SDK antérieur à iOS 27`);
  }
});
