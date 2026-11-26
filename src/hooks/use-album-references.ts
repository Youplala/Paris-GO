import type { ImageSource } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';

import { useStations } from '@/providers/stations-provider';
import { placeLabel } from '@/services/albums';
import { loadBhvpImages } from '@/services/bhvp-images';
import { historicalReferenceForFrame } from '@/services/camera-reference';
import type { SavedCapture } from '@/services/fieldbook-store';
import { formatContributorName } from '@/utils/community-stats';

export type AlbumReference = {
  /** La photo d'archive refaite, ou rien tant qu'elle n'est pas chargée. */
  image?: ImageSource;
  year: number;
  /** « Georges E. », ou rien si la notice ne nomme personne. */
  author?: string;
  source: string;
  place: string;
  /** « Secteur 995 · photo 7 » : distingue les reprises d'un même secteur. */
  label: string;
  isArchiveSector: boolean;
};

const BHVP_CREDIT = 'BHVP · fonds « C’était Paris en 1970 »';
const OBSERVATOIRE_CREDIT = 'Observatoire photo participatif · CAUE de Paris';

/**
 * Retrouve, pour chaque reprise d'un album, la photo d'archive refaite et ses crédits. Les
 * planches de 1970 sont chargées une fois par secteur, comme dans l'écran de comparaison.
 */
export function useAlbumReferences(captures: readonly SavedCapture[]) {
  const { findDetail } = useStations();
  const stationIds = useMemo(
    () => [...new Set(captures.map((capture) => capture.stationId))],
    [captures],
  );
  const details = useMemo(
    () => new Map(stationIds.map((id) => [id, findDetail(id)])),
    [findDetail, stationIds],
  );
  const [archiveImages, setArchiveImages] = useState<Record<string, ImageSource[]>>({});

  // Clé textuelle : un nouvel objet de détail pour le même secteur ne relance pas le chargement.
  const archiveKey = [...details]
    .filter(([, detail]) => detail?.kind === 'archive-1970' && detail.archiveLinks.length > 0)
    .map(([id, detail]) => `${id}\n${detail?.archiveLinks.join('\n')}`)
    .join('\n\n');

  useEffect(() => {
    let cancelled = false;
    for (const entry of archiveKey ? archiveKey.split('\n\n') : []) {
      const [id, ...links] = entry.split('\n');
      void loadBhvpImages(links).then((images) => {
        if (cancelled || images.length === 0) return;
        setArchiveImages((current) => ({ ...current, [id]: images }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [archiveKey]);

  return useMemo(() => {
    const references = new Map<string, AlbumReference>();
    for (const capture of captures) {
      const detail = details.get(capture.stationId);
      const isArchiveSector = detail?.kind === 'archive-1970';
      const images = isArchiveSector
        ? archiveImages[capture.stationId] ?? []
        : detail?.images ?? [];
      const reference = historicalReferenceForFrame({
        images,
        recaptureImage: detail?.recaptureImage,
        referenceImage: detail?.referenceImage,
        requestedFrame: capture.frameIndex,
      });
      const metadata = isArchiveSector
        ? detail?.archiveMetadata[reference.frameIndex]
        : detail?.referenceMetadata;
      const rawAuthor = (metadata?.author ?? detail?.author)?.trim();
      references.set(capture.id, {
        image: isArchiveSector && images.length === 0 ? undefined : reference.image,
        year: detail?.year ?? 1970,
        author: rawAuthor && !/non identifi/i.test(rawAuthor) ? formatContributorName(rawAuthor) : undefined,
        source: (detail?.year ?? 1970) === 1970 ? BHVP_CREDIT : OBSERVATOIRE_CREDIT,
        place: placeLabel(capture, isArchiveSector),
        label: isArchiveSector
          ? `${placeLabel(capture, true)} · photo ${reference.frameIndex + 1}`
          : placeLabel(capture, false),
        isArchiveSector,
      });
    }
    return references;
  }, [archiveImages, captures, details]);
}
