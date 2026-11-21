import AsyncStorage from '@react-native-async-storage/async-storage';

const IDENTITY_OFFER_KEY = 'reprise.official-identity-offer.v1';

type OfferStorage = {
  markOffered: () => Promise<void>;
  shouldOffer: () => Promise<boolean>;
};

/**
 * La proposition de mémoriser son identité n'est faite qu'une fois : refuser, c'est être
 * tranquille ensuite. L'identité reste modifiable depuis l'écran d'envoi.
 */
export function createIdentityOfferStorage(
  read: () => Promise<string | null>,
  write: () => Promise<void>,
): OfferStorage {
  let offeredThisSession = false;
  return {
    async shouldOffer() {
      if (offeredThisSession) return false;
      try {
        const stored = await read();
        return !offeredThisSession && stored !== 'offered';
      } catch {
        // Stockage indisponible : mieux vaut ne pas insister.
        return false;
      }
    },
    async markOffered() {
      offeredThisSession = true;
      try {
        await write();
      } catch {
        // Confort uniquement.
      }
    },
  };
}

const storage = createIdentityOfferStorage(
  () => AsyncStorage.getItem(IDENTITY_OFFER_KEY),
  () => AsyncStorage.setItem(IDENTITY_OFFER_KEY, 'offered'),
);

export const shouldOfferOfficialIdentity = () => storage.shouldOffer();
export const markOfficialIdentityOffered = () => storage.markOffered();
