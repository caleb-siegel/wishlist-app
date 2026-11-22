import { supabase } from '@/lib/supabase';
import { Wishlist, WishlistItem } from '@/types/database.types';

export const WishlistService = {
  /**
   * Fetches the owner's primary wishlist, or creates a default one if none exists.
   */
  async getOrCreateDefaultWishlist(userId: string): Promise<{ wishlist: Wishlist | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('wishlists')
        .select('*')
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        return { wishlist: null, error: new Error(error.message) };
      }

      if (data) {
        return { wishlist: data as Wishlist, error: null };
      }

      // If no wishlist exists, create the default one
      const { data: created, error: createError } = await supabase
        .from('wishlists')
        .insert({
          owner_user_id: userId,
          name: 'My Wishlist',
        })
        .select()
        .single();

      if (createError) {
        return { wishlist: null, error: new Error(createError.message) };
      }

      return { wishlist: created as Wishlist, error: null };
    } catch (e: any) {
      return { wishlist: null, error: e };
    }
  },

  /**
   * Fetches all items for a given wishlist.
   */
  async getWishlistItems(wishlistId: string): Promise<{ items: WishlistItem[]; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('wishlist_items')
        .select('*')
        .eq('wishlist_id', wishlistId)
        .order('created_at', { ascending: false });

      if (error) {
        return { items: [], error: new Error(error.message) };
      }

      return { items: (data as WishlistItem[]) || [], error: null };
    } catch (e: any) {
      return { items: [], error: e };
    }
  },

  /**
   * Creates a new wishlist item.
   */
  async createItem(item: {
    wishlist_id: string;
    url: string;
    title: string;
    image_url?: string | null;
    approx_price?: number | null;
    currency?: string;
    notes?: string | null;
    preference_level: 'would_love' | 'just_an_idea';
  }): Promise<{ item: WishlistItem | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('wishlist_items')
        .insert({
          wishlist_id: item.wishlist_id,
          url: item.url,
          title: item.title,
          image_url: item.image_url || null,
          approx_price: item.approx_price ?? null,
          currency: item.currency || 'USD',
          notes: item.notes || null,
          preference_level: item.preference_level,
        })
        .select()
        .single();

      if (error) {
        return { item: null, error: new Error(error.message) };
      }

      return { item: data as WishlistItem, error: null };
    } catch (e: any) {
      return { item: null, error: e };
    }
  },

  /**
   * Updates an existing wishlist item.
   */
  async updateItem(
    itemId: string,
    updates: Partial<WishlistItem>
  ): Promise<{ item: WishlistItem | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('wishlist_items')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .select()
        .single();

      if (error) {
        return { item: null, error: new Error(error.message) };
      }

      return { item: data as WishlistItem, error: null };
    } catch (e: any) {
      return { item: null, error: e };
    }
  },

  /**
   * Deletes a wishlist item.
   */
  async deleteItem(itemId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.from('wishlist_items').delete().eq('id', itemId);

      if (error) {
        return { error: new Error(error.message) };
      }

      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  },
};
