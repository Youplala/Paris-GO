export const ALBUM_TITLES_KEY = 'reprise.albums.titles.v1';
export const ALBUM_TITLE_MAX_LENGTH = 60;

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type AlbumTitles = Record<string, string>;

function parseTitles(raw: string | null): AlbumTitles {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] =>
          /^\d{4}-\d{2}-\d{2}$/.test(entry[0]) && typeof entry[1] === 'string' && entry[1].trim().length > 0,
      ),
    );
  } catch {
    return {};
  }
}

/** Nettoie un titre saisi : espaces superflus retirés, longueur bornée. */
export function normalizeAlbumTitle(title: string) {
  return title.replace(/\s+/g, ' ').trim().slice(0, ALBUM_TITLE_MAX_LENGTH);
}

/** Titres choisis par l'utilisateur, par jour de balade. Un titre vide rend le titre par défaut. */
export function createAlbumTitleStore(storage: StorageAdapter) {
  return {
    async list() {
      return parseTitles(await storage.getItem(ALBUM_TITLES_KEY));
    },
    async rename(albumId: string, title: string) {
      const titles = parseTitles(await storage.getItem(ALBUM_TITLES_KEY));
      const clean = normalizeAlbumTitle(title);
      if (clean) titles[albumId] = clean;
      else delete titles[albumId];
      await storage.setItem(ALBUM_TITLES_KEY, JSON.stringify(titles));
      return titles;
    },
  };
}
