import assert from 'node:assert/strict';
import test from 'node:test';

import {
  acceptsOfficialBridgeMessage,
  isAllowedOfficialNavigation,
  officialPageKind,
  shouldInjectOfficialScripts,
} from '../src/services/official-navigation.ts';

test('la frontière WebView accepte uniquement le formulaire et sa confirmation exacts', () => {
  assert.equal(officialPageKind('https://opppp.cartes.xyz/elements/add'), 'form');
  assert.equal(officialPageKind('https://opppp.cartes.xyz/elements/add?draft=1'), 'form');
  assert.equal(officialPageKind('https://opppp.cartes.xyz/elements/added'), 'success');
  assert.equal(officialPageKind('about:blank'), 'blank');

  for (const url of [
    'https://evil.opppp.cartes.xyz/elements/add',
    'https://opppp.cartes.xyz.evil.test/elements/add',
    'https://observatoire-photo.paris/elements/add',
    'https://observatoire-photo.paris/elements/added',
    'https://opppp.cartes.xyz:8443/elements/add',
    'https://user:secret@opppp.cartes.xyz/elements/add',
    'https://opppp.cartes.xyz/elements/add/extra',
    'https://opppp.cartes.xyz/elements/added/extra',
    'https://opppp.cartes.xyz/elements/additional',
    'https://opppp.cartes.xyz/elements/%61dd',
    'https://opppp.cartes.xyz/elements/add%2fextra',
    'https://opppp.cartes.xyz/map',
    'https://opppp.cartes.xyz/other',
    'https://opppp.cartes.xyz:443/elements/add',
    'https://user@opppp.cartes.xyz/elements/add',
    'http://opppp.cartes.xyz/elements/add',
  ]) {
    assert.equal(officialPageKind(url), 'untrusted', url);
    assert.equal(isAllowedOfficialNavigation(url), false, url);
    assert.equal(shouldInjectOfficialScripts(url), false, url);
    assert.equal(acceptsOfficialBridgeMessage(url), false, url);
  }
});

test('les scripts et messages natifs restent liés au formulaire de confiance', () => {
  assert.equal(shouldInjectOfficialScripts('https://opppp.cartes.xyz/elements/add'), true);
  assert.equal(acceptsOfficialBridgeMessage('https://opppp.cartes.xyz/elements/add'), true);
  assert.equal(shouldInjectOfficialScripts('https://opppp.cartes.xyz/elements/added'), false);
  assert.equal(acceptsOfficialBridgeMessage('https://opppp.cartes.xyz/elements/added'), false);
  assert.equal(shouldInjectOfficialScripts('about:blank'), false);
  assert.equal(shouldInjectOfficialScripts('about:blank', true), true);
  assert.equal(acceptsOfficialBridgeMessage('about:blank', true), true);
});
