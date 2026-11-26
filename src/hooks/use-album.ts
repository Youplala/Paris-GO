import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useAlbumReferences } from '@/hooks/use-album-references';
import { albumTitleStore } from '@/services/album-title-store';
import { albumPlaces, albumStats, defaultAlbumTitle, findAlbum, formatAlbumDay } from '@/services/albums';
import { getSavedCaptures, type SavedCapture } from '@/services/fieldbook';

const timeFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  hour: '2-digit',
  minute: '2-digit',
});

export type AlbumEntry = {
  capture: SavedCapture;
  /** « Photo 7 », ou le nom du point de l'Observatoire. */
  title: string;
  /** « Secteur 995 · 11:17 ». */
  subtitle: string;
  /** « Secteur 995 · photo 7 ». */
  label: string;
  place: string;
  current: { uri: string };
  reference?: import('expo-image').ImageSource;
  referenceYear: number;
  currentYear: string;
  /** « 1970 · Georges E. · BHVP · fonds « C’était Paris en 1970 » ». */
  referenceCredit: string;
  isArchiveSector: boolean;
};

/** Une balade du carnet, ses reprises résolues (archives, crédits) et ses chiffres. */
export function useAlbum(id?: string) {
  const [captures, setCaptures] = useState<SavedCapture[]>();
  const [customTitle, setCustomTitle] = useState<string>();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([getSavedCaptures(), albumTitleStore.list()])
        .then(([saved, titles]) => {
          if (cancelled) return;
          setCaptures(saved);
          setCustomTitle(id ? titles[id] : undefined);
        })
        .catch(() => {
          if (!cancelled) setCaptures([]);
        });
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  const album = useMemo(() => (captures && id ? findAlbum(captures, id) : undefined), [captures, id]);
  const albumCaptures = useMemo(() => album?.captures ?? [], [album]);
  const references = useAlbumReferences(albumCaptures);

  const entries: AlbumEntry[] = useMemo(
    () =>
      albumCaptures.map((capture) => {
        const reference = references.get(capture.id);
        const label = reference?.label ?? capture.stationName ?? 'Paris';
        const [place, photo] = label.split(' · ');
        const referenceYear = reference?.year ?? 1970;
        return {
          capture,
          title: photo ? photo.charAt(0).toLocaleUpperCase('fr-FR') + photo.slice(1) : place,
          subtitle: [photo ? place : undefined, timeFormat.format(new Date(capture.createdAt))].filter(Boolean).join(' · '),
          label,
          place,
          current: { uri: capture.imageUri ?? '' },
          reference: reference?.image,
          referenceYear,
          currentYear: capture.createdAt.slice(0, 4),
          referenceCredit: [String(referenceYear), reference?.author, reference?.source].filter(Boolean).join(' · '),
          isArchiveSector: Boolean(reference?.isArchiveSector),
        };
      }),
    [albumCaptures, references],
  );

  const stats = album ? albumStats(album) : undefined;
  const albumYear = album ? Number(album.id.slice(0, 4)) : undefined;
  const oldest = entries.length ? Math.min(...entries.map((entry) => entry.referenceYear)) : undefined;
  const places = album ? albumPlaces(album, (capture) => references.get(capture.id)?.place ?? capture.stationId) : [];

  return {
    loading: !captures,
    album,
    entries,
    stats,
    places,
    title: customTitle ?? (album ? defaultAlbumTitle(album) : 'Balade'),
    customTitle,
    setCustomTitle,
    day: album ? formatAlbumDay(album.id) : '',
    yearsApart: albumYear && oldest ? albumYear - oldest : undefined,
    allSectors: entries.length > 0 && entries.every((entry) => entry.isArchiveSector),
  };
}
