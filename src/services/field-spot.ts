export type Coordinate = { latitude: number; longitude: number };
/** [ouest, sud, est, nord], comme dans les instantanés. */
export type SquareBounds = [number, number, number, number];

/** Marge autour du carré de 250 m à partir de laquelle on dit « vous êtes dans la zone ». */
export const IN_ZONE_MARGIN_METERS = 150;

const EARTH_RADIUS_METERS = 6_371_000;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance entre un point et le rectangle (0 s'il est dedans). */
export function distanceToBoundsMeters(point: Coordinate, bounds: SquareBounds): number {
  const [west, south, east, north] = bounds;
  const nearest = {
    latitude: Math.min(north, Math.max(south, point.latitude)),
    longitude: Math.min(east, Math.max(west, point.longitude)),
  };
  return distanceMeters(point, nearest);
}

export type SpotProximity = {
  /** Distance jusqu'au centre du lieu, en mètres. */
  distance: number;
  inZone: boolean;
};

export function spotProximity(
  user: Coordinate,
  target: Coordinate,
  bounds?: SquareBounds,
): SpotProximity {
  const distance = distanceMeters(user, target);
  const edge = bounds ? distanceToBoundsMeters(user, bounds) : distance;
  return { distance, inZone: edge <= IN_ZONE_MARGIN_METERS };
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

/** Itinéraire à pied : Plans sur iOS, navigation Google (ou géo) ailleurs. */
export function walkingDirectionsUrls(target: Coordinate, os: string): string[] {
  const { latitude, longitude } = target;
  if (os === 'ios') {
    return [`http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=w`];
  }
  return [
    `google.navigation:q=${latitude},${longitude}&mode=w`,
    `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
  ];
}
