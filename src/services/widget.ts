import * as SecureStore from 'expo-secure-store';
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

const WIDGET_STORAGE_KEY = 'wishlist_widget_snapshot';

export const WidgetService = {
  /**
   * Updates the snapshot shared with the native iOS and Android widgets.
   * STRICT PRIVACY RULE: Never writes private shopper purchases or notes.
   */
  async updateWidgetSnapshot(data: {
    isLoggedIn: boolean;
    nextOccasion?: WidgetOccasion | null;
    wishlistPreview?: WidgetItemPreview[];
  }): Promise<void> {
    try {
      const snapshot: WidgetDataSnapshot = {
        isLoggedIn: data.isLoggedIn,
        nextOccasion: data.nextOccasion || null,
        wishlistPreview: data.wishlistPreview || [],
        updatedAt: new Date().toISOString(),
      };

      const jsonString = JSON.stringify(snapshot);

      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(WIDGET_STORAGE_KEY, jsonString);
        }
        return;
      }

      await SecureStore.setItemAsync(WIDGET_STORAGE_KEY, jsonString);
    } catch (e) {
      console.warn('Failed to update widget snapshot:', e);
    }
  },

  /**
   * Clears the widget snapshot on sign out so no private data remains visible.
   */
  async clearWidgetSnapshot(): Promise<void> {
    await this.updateWidgetSnapshot({
      isLoggedIn: false,
      nextOccasion: null,
      wishlistPreview: [],
    });
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

      const raw = await SecureStore.getItemAsync(WIDGET_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};
