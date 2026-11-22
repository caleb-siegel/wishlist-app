import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';

export interface WidgetOccasion {
  name: string;
  date: string;
  daysRemaining: number;
  deepLink: string;
}

export interface WidgetItemPreview {
  title: string;
  price: string;
  deepLink: string;
}

export interface WidgetDataSnapshot {
  isLoggedIn: boolean;
  nextOccasion: WidgetOccasion | null;
  wishlistPreview: WidgetItemPreview[];
  updatedAt: string;
}

const APP_GROUP = 'group.com.calebsiegel.wishlist';
const WIDGET_STORAGE_KEY = 'wishlist_widget_snapshot';

let storageInstance: ExtensionStorage | null = null;
function getStorage(): ExtensionStorage | null {
  if (Platform.OS === 'ios') {
    if (!storageInstance) {
      storageInstance = new ExtensionStorage(APP_GROUP);
    }
    return storageInstance;
  }
  return null;
}

export const WidgetService = {
  /**
   * Updates the snapshot shared with the native iOS widget via App Groups.
   * Merges with existing state so updating one tab does not erase another's data.
   * STRICT PRIVACY RULE: Never writes private shopper purchases or notes.
   */
  async updateWidgetSnapshot(data: {
    isLoggedIn: boolean;
    nextOccasion?: WidgetOccasion | null;
    wishlistPreview?: WidgetItemPreview[];
  }): Promise<void> {
    try {
      const existing = await this.getWidgetSnapshot();

      const snapshot: WidgetDataSnapshot = {
        isLoggedIn: data.isLoggedIn,
        nextOccasion:
          data.nextOccasion !== undefined
            ? data.nextOccasion
            : existing?.nextOccasion ?? null,
        wishlistPreview:
          data.wishlistPreview !== undefined
            ? data.wishlistPreview
            : existing?.wishlistPreview ?? [],
        updatedAt: new Date().toISOString(),
      };

      const jsonString = JSON.stringify(snapshot);

      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(WIDGET_STORAGE_KEY, jsonString);
        }
        return;
      }

      if (Platform.OS === 'ios') {
        const storage = getStorage();
        if (storage) {
          storage.set(WIDGET_STORAGE_KEY, jsonString);
          ExtensionStorage.reloadWidget();
        }
      }
    } catch (e) {
      console.warn('Failed to update widget snapshot:', e);
    }
  },

  /**
   * Clears the widget snapshot on sign out so no private data remains visible.
   */
  async clearWidgetSnapshot(): Promise<void> {
    try {
      const snapshot: WidgetDataSnapshot = {
        isLoggedIn: false,
        nextOccasion: null,
        wishlistPreview: [],
        updatedAt: new Date().toISOString(),
      };

      const jsonString = JSON.stringify(snapshot);

      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(WIDGET_STORAGE_KEY, jsonString);
        }
        return;
      }

      if (Platform.OS === 'ios') {
        const storage = getStorage();
        if (storage) {
          storage.set(WIDGET_STORAGE_KEY, jsonString);
          ExtensionStorage.reloadWidget();
        }
      }
    } catch (e) {
      console.warn('Failed to clear widget snapshot:', e);
    }
  },

  /**
   * Reads the current widget snapshot (useful for debugging and preview).
   */
  async getWidgetSnapshot(): Promise<WidgetDataSnapshot | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(WIDGET_STORAGE_KEY);
          return raw ? JSON.parse(raw) : null;
        }
        return null;
      }

      if (Platform.OS === 'ios') {
        const storage = getStorage();
        const raw = storage?.get(WIDGET_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      }

      return null;
    } catch {
      return null;
    }
  },
};
