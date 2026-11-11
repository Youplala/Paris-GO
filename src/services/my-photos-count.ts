import { useSyncExternalStore } from 'react';

import { getSavedCaptures } from '@/services/fieldbook';

/**
 * Nombre de photos à envoyer, partagé entre l'accueil, l'onglet « Mes photos » et le badge de la
 * barre d'onglets. Les écrans qui lisent déjà les photos publient ici ce qu'ils ont vu ; la barre
 * d'onglets, qui reste montée, se met à jour sans relire le stockage.
 */
let toSendCount = 0;
const listeners = new Set<() => void>();

export function setToSendCount(next: number) {
  if (next === toSendCount) return;
  toSendCount = next;
  listeners.forEach((listener) => listener());
}

export async function refreshToSendCount() {
  try {
    const captures = await getSavedCaptures();
    setToSendCount(captures.filter((capture) => !capture.submittedAt).length);
  } catch {
    // Le badge est un confort : une lecture impossible le laisse tel quel.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useToSendCount() {
  return useSyncExternalStore(subscribe, () => toSendCount, () => 0);
}
