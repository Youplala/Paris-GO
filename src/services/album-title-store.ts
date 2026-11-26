import AsyncStorage from '@react-native-async-storage/async-storage';

import { createAlbumTitleStore } from '@/services/album-titles';

export const albumTitleStore = createAlbumTitleStore(AsyncStorage);
