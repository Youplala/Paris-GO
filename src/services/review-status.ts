export type CaptureLocation = {
  latitude: number;
  longitude: number;
  precision: 'precise' | 'approximate';
};

export type ReviewNotice = {
  icon: 'exclamationmark.circle.fill' | 'info.circle.fill';
  message: string;
};

/**
 * Seule information de position qui compte pour l'utilisateur : une position absente ou
 * approximative. Une position précise, ou le mode démo, ne demande aucun commentaire.
 */
export function getLocationNotice(input: {
  simulated: boolean;
  location?: CaptureLocation;
}): ReviewNotice | undefined {
  if (input.simulated) return undefined;
  if (!input.location) {
    return {
      icon: 'exclamationmark.circle.fill',
      message: 'Position non enregistrée : vérifiez l’adresse dans le formulaire.',
    };
  }
  if (input.location.precision === 'approximate') {
    return {
      icon: 'info.circle.fill',
      message: 'Position approximative : vérifiez l’adresse dans le formulaire.',
    };
  }
  return undefined;
}

export type SaveStatusInput = {
  simulated: boolean;
  saving: boolean;
  saved: boolean;
  savedToLibrary: boolean;
  failed: boolean;
};

export type SaveStatus = {
  tone: 'progress' | 'done' | 'error';
  message: string;
};

/** Confirmation discrète de l'enregistrement automatique dans Mes photos. */
export function getSaveStatus(input: SaveStatusInput): SaveStatus | undefined {
  if (input.failed) {
    return { tone: 'error', message: 'Votre photo n’a pas pu être enregistrée dans Mes photos.' };
  }
  if (input.saving || !input.saved) {
    return { tone: 'progress', message: 'Enregistrement dans Mes photos…' };
  }
  if (input.simulated) {
    return {
      tone: 'done',
      message: 'Aperçu ajouté à Mes photos. Aucune photo créée en mode démo.',
    };
  }
  return {
    tone: 'done',
    message: input.savedToLibrary
      ? 'Enregistrée dans Mes photos et dans Photos (Récents).'
      : 'Enregistrée dans Mes photos. La copie dans Photos n’a pas abouti.',
  };
}
