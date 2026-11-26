import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { albumTitleStore } from '@/services/album-title-store';
import type { AlbumTitles } from '@/services/album-titles';
import { defaultAlbumTitle, groupCapturesIntoAlbums, walkDistanceMeters, formatWalkDistance } from '@/services/albums';
import { getSavedCaptures, type SavedCapture } from '@/services/fieldbook';

/** Le carnet relu à chaque retour sur l'écran : reprises, balades et titres choisis. */
export function useAlbums() {
  const [captures, setCaptures] = useState<SavedCapture[]>();
  const [titles, setTitles] = useState<AlbumTitles>({});
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setError(false);
    try {
      const [saved, savedTitles] = await Promise.all([
        getSavedCaptures(),
        albumTitleStore.list().catch(() => ({})),
      ]);
      setCaptures(saved);
      setTitles(savedTitles);
    } catch {
      setError(true);
      setCaptures((current) => current ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const albums = useMemo(() => groupCapturesIntoAlbums(captures ?? []), [captures]);
  const totalDistance = useMemo(
    () => formatWalkDistance(albums.reduce((sum, album) => sum + walkDistanceMeters(album.captures.map((capture) => capture.coordinate)), 0)),
    [albums],
  );

  return {
    loading: !captures,
    error,
    reload,
    captures: captures ?? [],
    setCaptures,
    albums,
    totalDistance,
    titleFor: (album: { id: string }) => titles[album.id] ?? defaultAlbumTitle(album),
  };
}
