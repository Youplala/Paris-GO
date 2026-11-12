import type { ImageSource } from 'expo-image';

/**
 * L'accueil n'a pas besoin des originaux de plusieurs mégapixels. Les trois pages se montent
 * ensemble : chargées en pleine taille, les vignettes du radar (4 à 5 Mo chacune) saturaient la
 * connexion et faisaient expirer la photo de 2026 de la comparaison.
 */
export function onboardingImageSource(source: ImageSource, width = 1200): ImageSource {
  if (!source.uri) return source;

  try {
    const url = new URL(source.uri);
    // Réutiliser uniquement le CDN déjà déclaré ; ne pas transmettre d'autres sources.
    if (url.origin !== 'https://i0.wp.com' || !url.pathname.startsWith('/observatoire-photo.paris/')) {
      return source;
    }
    url.searchParams.set('w', String(width));
    url.searchParams.set('quality', '85');
    return { ...source, uri: url.toString() };
  } catch {
    return source;
  }
}
