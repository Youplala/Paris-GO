import type { SavedCapture } from '@/services/fieldbook-store';

/**
 * Une balade : les reprises du carnet prises le même jour (heure de Paris), dans l'ordre de la
 * marche. Rien n'est stocké : l'album se recalcule à partir du carnet, seul son titre choisi par
 * l'utilisateur est mémorisé à part.
 */
export type Album = {
  /** Jour local de la balade, « 2026-07-14 » : identifiant stable de l'album. */
  id: string;
  captures: SavedCapture[];
  startedAt: string;
  endedAt: string;
};

type Coordinate = { latitude: number; longitude: number };

const PARIS_TIME_ZONE = 'Europe/Paris';

const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** « 2026-07-14T22:30:00Z » → « 2026-07-15 » : le jour vécu à Paris, pas celui d'UTC. */
export function albumDayKey(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return undefined;
  return dayKeyFormat.format(date);
}

/**
 * Regroupe les reprises par jour, la balade la plus récente d'abord. Les captures de
 * démonstration, sans photo réelle, ne forment pas d'album.
 */
export function groupCapturesIntoAlbums(captures: readonly SavedCapture[]): Album[] {
  const byDay = new Map<string, SavedCapture[]>();
  for (const capture of captures) {
    if (capture.simulated || !capture.imageUri) continue;
    const day = albumDayKey(capture.createdAt);
    if (!day) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), capture]);
  }

  return [...byDay.entries()]
    .map(([id, dayCaptures]) => {
      const ordered = [...dayCaptures].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return {
        id,
        captures: ordered,
        startedAt: ordered[0].createdAt,
        endedAt: ordered[ordered.length - 1].createdAt,
      };
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}

export function findAlbum(captures: readonly SavedCapture[], id: string) {
  return groupCapturesIntoAlbums(captures).find((album) => album.id === id);
}

const EARTH_RADIUS_METERS = 6_371_000;

function haversineMeters(a: Coordinate, b: Coordinate) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/** Distance à vol d'oiseau d'une reprise à la suivante : un minimum, jamais une trace GPS. */
export function walkDistanceMeters(coordinates: readonly (Coordinate | undefined)[]) {
  const points = coordinates.filter((point): point is Coordinate => Boolean(point));
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineMeters(points[index - 1], points[index]);
  }
  return total;
}

/** « 2,4 km », « 850 m » ; rien sous 100 m, la marche n'a alors pas de sens. */
export function formatWalkDistance(meters: number) {
  if (meters < 100) return undefined;
  if (meters < 1000) return `${Math.round(meters / 50) * 50} m`;
  const kilometers = meters / 1000;
  return `${kilometers.toLocaleString('fr-FR', {
    maximumFractionDigits: kilometers < 10 ? 1 : 0,
    minimumFractionDigits: kilometers < 10 ? 1 : 0,
  })} km`;
}

export type AlbumStats = {
  count: number;
  places: number;
  distance?: string;
  hasRoute: boolean;
};

export function albumStats(album: Album): AlbumStats {
  const coordinates = album.captures.map((capture) => capture.coordinate);
  return {
    count: album.captures.length,
    places: new Set(album.captures.map((capture) => capture.stationId)).size,
    distance: formatWalkDistance(walkDistanceMeters(coordinates)),
    hasRoute: coordinates.filter(Boolean).length >= 2,
  };
}

const titleDayFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
});
const titleDayYearFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const longDayFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function dayAsUtcDate(id: string) {
  return new Date(`${id}T12:00:00Z`);
}

/** « Balade du 14 juillet » ; l'année n'apparaît que si la balade n'est pas de l'année en cours. */
export function defaultAlbumTitle(album: Pick<Album, 'id'>, now = new Date()) {
  const date = dayAsUtcDate(album.id);
  const sameYear = album.id.slice(0, 4) === albumDayKey(now.toISOString())?.slice(0, 4);
  const day = (sameYear ? titleDayFormat : titleDayYearFormat).format(date);
  return `Balade du ${day.replace(/^1 /, '1er ')}`;
}

/** « Dimanche 14 juillet 2026 ». */
export function formatAlbumDay(id: string) {
  const label = longDayFormat.format(dayAsUtcDate(id));
  return label.charAt(0).toLocaleUpperCase('fr-FR') + label.slice(1);
}

/** Lieux de la balade, dans l'ordre de la marche et sans doublon. */
export function albumPlaces(album: Album, labelFor: (capture: SavedCapture) => string) {
  const places: string[] = [];
  for (const capture of album.captures) {
    const label = labelFor(capture);
    if (!places.includes(label)) places.push(label);
  }
  return places;
}

/** « Secteur 995 », « Secteur 995 et 2 autres lieux ». */
export function summarizePlaces(places: readonly string[]) {
  if (places.length === 0) return '';
  if (places.length === 1) return places[0];
  const others = places.length - 1;
  return `${places[0]} et ${others} ${others > 1 ? 'autres lieux' : 'autre lieu'}`;
}

/** Libellé d'une reprise pour un lieu de 1970 (« Secteur 995 ») ou un point de l'Observatoire. */
export function placeLabel(capture: Pick<SavedCapture, 'stationId' | 'stationName'>, isArchiveSector: boolean) {
  const name = capture.stationName?.trim();
  if (!name) return `Point ${capture.stationId}`;
  return isArchiveSector && /^\d+$/.test(name) ? `Secteur ${name}` : name;
}
