export type RoutePoint = { latitude: number; longitude: number };
export type RouteStep = RoutePoint & { index: number };
export type RouteStop = RoutePoint & { label: string; steps: number[] };

/**
 * Les reprises faites au même endroit partagent un seul repère (≈ 40 m) : sur la carte, deux
 * pastilles empilées se cachent l'une l'autre.
 */
export function groupRouteStops(points: readonly RouteStep[]): RouteStop[] {
  const stops: { latitude: number; longitude: number; steps: number[] }[] = [];
  for (const point of points) {
    const near = stops.find(
      (stop) =>
        Math.abs(stop.latitude - point.latitude) < 0.00036 &&
        Math.abs(stop.longitude - point.longitude) < 0.00054,
    );
    if (near) near.steps.push(point.index);
    else stops.push({ latitude: point.latitude, longitude: point.longitude, steps: [point.index] });
  }
  return stops.map((stop) => ({
    ...stop,
    label: stop.steps.map((step) => step + 1).join('·'),
  }));
}

/**
 * Le tracé partiel à l'instant `progress` (0 → 1) : les segments parcourus en entier, puis un
 * point interpolé sur le segment en cours. Sert à dessiner la balade comme un trait qui avance.
 */
export function partialRoute(points: readonly RoutePoint[], progress: number): RoutePoint[] {
  if (points.length < 2) return [...points];
  const clamped = Math.min(1, Math.max(0, progress));
  const segments = points.length - 1;
  const position = clamped * segments;
  const whole = Math.floor(position);
  if (whole >= segments) return [...points];
  const ratio = position - whole;
  const from = points[whole];
  const to = points[whole + 1];
  return [
    ...points.slice(0, whole + 1),
    {
      latitude: from.latitude + (to.latitude - from.latitude) * ratio,
      longitude: from.longitude + (to.longitude - from.longitude) * ratio,
    },
  ];
}

const toMercatorY = (latitude: number) => {
  const radians = (latitude * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
};
const fromMercatorY = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
const toMercatorX = (longitude: number) => (longitude * Math.PI) / 180;

export type SquareRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
  /** Emprise en coordonnées de Mercator, pour reprojeter le tracé sur l'image. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

/**
 * Une région carrée (en Mercator) qui contient toute la balade avec une marge : c'est l'emprise
 * de l'image de carte partagée, sur laquelle le tracé est redessiné point par point.
 */
export function squareRegionFor(points: readonly RoutePoint[], padding = 0.35, minSpan = 0.00012): SquareRegion | undefined {
  if (points.length === 0) return undefined;
  const xs = points.map((point) => toMercatorX(point.longitude));
  const ys = points.map((point) => toMercatorY(point.latitude));
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), minSpan) * (1 + padding * 2);
  const bounds = {
    minX: centerX - span / 2,
    maxX: centerX + span / 2,
    minY: centerY - span / 2,
    maxY: centerY + span / 2,
  };
  const north = fromMercatorY(bounds.maxY);
  const south = fromMercatorY(bounds.minY);
  return {
    latitude: (north + south) / 2,
    longitude: (centerX * 180) / Math.PI,
    latitudeDelta: north - south,
    longitudeDelta: (span * 180) / Math.PI,
    bounds,
  };
}

/** Position d'un point de la balade sur une image carrée de côté `size`. */
export function projectOnSquare(point: RoutePoint, region: SquareRegion, size: number) {
  const { minX, maxX, minY, maxY } = region.bounds;
  return {
    x: ((toMercatorX(point.longitude) - minX) / (maxX - minX)) * size,
    y: ((maxY - toMercatorY(point.latitude)) / (maxY - minY)) * size,
  };
}

/** Des points réguliers le long du tracé projeté : le pointillé blanc de la carte partagée. */
export function dottedPath(points: readonly { x: number; y: number }[], spacing: number) {
  const dots: { x: number; y: number }[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const count = Math.max(1, Math.floor(length / spacing));
    for (let step = 0; step < count; step += 1) {
      const ratio = step / count;
      dots.push({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio });
    }
  }
  if (points.length) dots.push(points[points.length - 1]);
  return dots;
}
