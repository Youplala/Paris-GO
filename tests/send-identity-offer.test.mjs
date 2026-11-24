import assert from 'node:assert/strict';
import test from 'node:test';

import { createIdentityOfferStorage } from '../src/services/send-identity-offer.ts';

test('propose l’identité une seule fois', async () => {
  let stored = null;
  const storage = createIdentityOfferStorage(
    async () => stored,
    async () => {
      stored = 'offered';
    },
  );
  assert.equal(await storage.shouldOffer(), true);
  await storage.markOffered();
  assert.equal(await storage.shouldOffer(), false);
  const next = createIdentityOfferStorage(async () => stored, async () => undefined);
  assert.equal(await next.shouldOffer(), false);
});

test('n’insiste pas si le stockage est indisponible', async () => {
  const storage = createIdentityOfferStorage(
    async () => {
      throw new Error('indisponible');
    },
    async () => {
      throw new Error('indisponible');
    },
  );
  assert.equal(await storage.shouldOffer(), false);
  await storage.markOffered();
});
