import type { SavedCapture } from '@/services/fieldbook-store';

export type FieldbookViewState =
  | { kind: 'empty'; title: string; description: string }
  | {
      kind: 'filled';
      count: number;
      captures: SavedCapture[];
      /** Photos prises mais pas encore envoyées à l'Observatoire. */
      toSend: SavedCapture[];
      /** Photos envoyées, en attente de validation par l'Observatoire. */
      sent: SavedCapture[];
    };

export function getFieldbookViewState(captures: SavedCapture[]): FieldbookViewState {
  if (captures.length === 0) {
    return {
      kind: 'empty',
      title: 'Pas encore de photo',
      description: 'Refaites une photo de 1970 : elle apparaîtra ici, prête à être envoyée.',
    };
  }
  return {
    kind: 'filled',
    count: captures.length,
    captures,
    toSend: captures.filter((capture) => !capture.submittedAt),
    sent: captures.filter((capture) => Boolean(capture.submittedAt)),
  };
}
