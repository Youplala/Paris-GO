const MIN_VALID_ASPECT_RATIO = 0.1;
const MAX_VALID_ASPECT_RATIO = 10;

export function comparisonDimensionsForAspectRatio(
  availableWidth: number,
  aspectRatio: number,
  maxHeight: number,
  fallbackHeight = 280,
) {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
    return { width: Math.max(0, availableWidth), height: fallbackHeight };
  }

  if (
    !Number.isFinite(aspectRatio) ||
    aspectRatio < MIN_VALID_ASPECT_RATIO ||
    aspectRatio > MAX_VALID_ASPECT_RATIO
  ) {
    return { width: availableWidth, height: fallbackHeight };
  }

  const naturalHeight = availableWidth / aspectRatio;
  if (!Number.isFinite(maxHeight) || maxHeight <= 0 || naturalHeight <= maxHeight) {
    return { width: availableWidth, height: naturalHeight };
  }

  return { width: maxHeight * aspectRatio, height: maxHeight };
}

export type Rect = { left: number; top: number; width: number; height: number };

const EMPTY_RECT: Rect = { left: 0, top: 0, width: 0, height: 0 };

/** Plus grand rectangle au ratio demandé, centré dans la zone disponible. */
export function fitAspectRatioInArea(area: Rect, aspectRatio: number): Rect {
  if (
    !(area.width > 0) ||
    !(area.height > 0) ||
    !Number.isFinite(aspectRatio) ||
    aspectRatio < MIN_VALID_ASPECT_RATIO ||
    aspectRatio > MAX_VALID_ASPECT_RATIO
  ) {
    return EMPTY_RECT;
  }

  let width = area.width;
  let height = width / aspectRatio;
  if (height > area.height) {
    height = area.height;
    width = height * aspectRatio;
  }

  return {
    left: area.left + (area.width - width) / 2,
    top: area.top + (area.height - height) / 2,
    width,
    height,
  };
}

/**
 * Zone de la photo prise qui correspond au cadre affiché dans le viseur.
 *
 * L'aperçu caméra remplit la vue en mode « cover » : le capteur déborde d'un côté et l'écran
 * n'en montre qu'une partie. Recadrer simplement au centre de la photo garderait donc ce qui
 * dépasse de l'écran ; on projette plutôt le cadre visible dans les pixels de la photo.
 */
export function photoCropForViewfinderFrame({
  photoWidth,
  photoHeight,
  viewWidth,
  viewHeight,
  frame,
}: {
  photoWidth: number;
  photoHeight: number;
  viewWidth: number;
  viewHeight: number;
  frame: Rect;
}): Rect | undefined {
  if (
    !(photoWidth > 0) ||
    !(photoHeight > 0) ||
    !(viewWidth > 0) ||
    !(viewHeight > 0) ||
    !(frame.width > 0) ||
    !(frame.height > 0)
  ) {
    return undefined;
  }

  const scale = Math.max(viewWidth / photoWidth, viewHeight / photoHeight);
  const offsetX = (viewWidth - photoWidth * scale) / 2;
  const offsetY = (viewHeight - photoHeight * scale) / 2;

  const width = Math.min(photoWidth, frame.width / scale);
  const height = Math.min(photoHeight, frame.height / scale);
  const left = Math.min(Math.max(0, (frame.left - offsetX) / scale), photoWidth - width);
  const top = Math.min(Math.max(0, (frame.top - offsetY) / scale), photoHeight - height);

  // L'arrondi ne doit jamais faire déborder la découpe hors de la photo.
  const roundedLeft = Math.round(left);
  const roundedTop = Math.round(top);
  return {
    left: roundedLeft,
    top: roundedTop,
    width: Math.min(Math.round(width), photoWidth - roundedLeft),
    height: Math.min(Math.round(height), photoHeight - roundedTop),
  };
}
