import { archiveLinksOf, archiveMetadataOf, type Snapshot, type SquareBounds } from '@/data/snapshot';
import type { Coordinate } from '@/types/station';
import { archivePhotoKey, buildArchiveRecaptureIndex } from '@/utils/archive-recaptures';
import { contributorKey, formatContributorName } from '@/utils/community-stats';

export type PhotographerFrame = {
  /** Rang de la vue dans la pellicule du secteur, pour ouvrir la fiche sur la bonne photo. */
  frameIndex: number;
  link: string;
  recaptures: { id: string; author?: string; date?: string }[];
};

export type PhotographerSector = {
  squareId: string;
  name: string;
  coordinate: Coordinate;
  bounds?: SquareBounds;
  frames: PhotographerFrame[];
  recapturedCount: number;
};

export type ArchivePhotographer = {
  key: string;
  /** Nom tel que la notice BHVP l'écrit (« Ernoult, Georges »), pour les liens. */
  name: string;
  /** « Georges E. », comme partout ailleurs dans l'app. */
  displayName: string;
  candidateNumbers: string[];
  sectors: PhotographerSector[];
  photoCount: number;
  recapturedCount: number;
  /** Rues citées par ses notices, les plus fréquentes d'abord. */
  streets: string[];
  /** Contributeurs de 2026 qui ont refait ses photos, les plus assidus d'abord. */
  recapturedBy: { name: string; count: number }[];
};

/** Les notices sans auteur (« Photographe non identifié ») n'ouvrent pas de profil. */
export function isIdentifiedPhotographer(name?: string): name is string {
  return Boolean(name?.trim() && !/non identifi/i.test(name));
}

const indexes = new WeakMap<Snapshot, Map<string, ArchivePhotographer>>();

function buildIndex(snapshot: Snapshot) {
  const recaptureIndex = buildArchiveRecaptureIndex(snapshot.stations);
  const profiles = new Map<string, ArchivePhotographer>();
  const streetCounts = new Map<string, Map<string, number>>();
  const contributorCounts = new Map<string, Map<string, number>>();

  for (const square of snapshot.squares) {
    const links = archiveLinksOf(snapshot, square);
    const metadata = archiveMetadataOf(snapshot, square);
    const sectorsByKey = new Map<string, PhotographerSector>();

    links.forEach((link, frameIndex) => {
      const notice = metadata[frameIndex];
      if (!isIdentifiedPhotographer(notice?.author)) return;
      const key = contributorKey(notice.author);

      let profile = profiles.get(key);
      if (!profile) {
        profile = {
          key,
          name: notice.author,
          displayName: formatContributorName(notice.author),
          candidateNumbers: [],
          sectors: [],
          photoCount: 0,
          recapturedCount: 0,
          streets: [],
          recapturedBy: [],
        };
        profiles.set(key, profile);
      }
      if (notice.candidateNumber && !profile.candidateNumbers.includes(notice.candidateNumber)) {
        profile.candidateNumbers.push(notice.candidateNumber);
      }

      let sector = sectorsByKey.get(key);
      if (!sector) {
        sector = {
          squareId: square.id,
          name: square.name,
          coordinate: square.coordinate,
          bounds: square.bounds,
          frames: [],
          recapturedCount: 0,
        };
        sectorsByKey.set(key, sector);
        profile.sectors.push(sector);
        // Les rues décrivent le dossier entier : on les compte une fois par secteur, pas par vue.
        const streets = streetCounts.get(key) ?? new Map<string, number>();
        for (const street of notice.locations ?? []) streets.set(street, (streets.get(street) ?? 0) + 1);
        streetCounts.set(key, streets);
      }

      const photoKey = archivePhotoKey(link);
      const recaptures = (photoKey ? recaptureIndex.get(photoKey) : undefined) ?? [];
      sector.frames.push({
        frameIndex,
        link,
        recaptures: recaptures.map((station) => ({
          id: station.id,
          author: station.recaptureAuthor,
          date: station.recaptureDate,
        })),
      });
      profile.photoCount += 1;
      if (recaptures.length) {
        sector.recapturedCount += 1;
        profile.recapturedCount += 1;
        const contributors = contributorCounts.get(key) ?? new Map<string, number>();
        for (const station of recaptures) {
          if (station.recaptureAuthor) {
            contributors.set(station.recaptureAuthor, (contributors.get(station.recaptureAuthor) ?? 0) + 1);
          }
        }
        contributorCounts.set(key, contributors);
      }
    });
  }

  const byCount = (counts?: Map<string, number>) =>
    [...(counts ?? new Map<string, number>())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));

  for (const profile of profiles.values()) {
    profile.sectors.sort((a, b) => b.frames.length - a.frames.length || a.name.localeCompare(b.name, 'fr', { numeric: true }));
    profile.streets = byCount(streetCounts.get(profile.key)).map(([street]) => street);
    profile.recapturedBy = byCount(contributorCounts.get(profile.key)).map(([name, count]) => ({ name, count }));
  }
  return profiles;
}

/** Le profil d'un photographe du concours de 1970, toutes ses vues et tous ses secteurs. */
export function buildArchivePhotographer(snapshot: Snapshot, name: string) {
  let index = indexes.get(snapshot);
  if (!index) {
    index = buildIndex(snapshot);
    indexes.set(snapshot, index);
  }
  return index.get(contributorKey(name));
}
