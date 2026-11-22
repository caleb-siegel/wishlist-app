import { supabase } from '@/lib/supabase';
import { PrivatePurchase, WishlistItem } from '@/types/database.types';

export const PurchasesService = {
  /**
   * Fetches all private purchase records belonging to this shopper.
   * RLS guarantees that only rows where shopper_user_id = auth.uid() are returned.
   */
  async getMyPurchases(shopperUserId: string): Promise<{ purchases: PrivatePurchase[]; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('private_purchases')
        .select('*')
        .eq('shopper_user_id', shopperUserId)
        .order('purchased_at', { ascending: false });

      if (error) {
        return { purchases: [], error: new Error(error.message) };
      }

      return { purchases: (data as PrivatePurchase[]) || [], error: null };
    } catch (e: any) {
      return { purchases: [], error: e };
    }
  },

  /**
   * Privately marks an item as purchased.
   * Stores an immutable snapshot so the shopper never loses their record even if the owner deletes the item.
   */
  async markAsPurchased(
    shopperUserId: string,
    item: WishlistItem,
    notes?: string
  ): Promise<{ purchase: PrivatePurchase | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('private_purchases')
        .insert({
          shopper_user_id: shopperUserId,
          source_item_id: item.id,
          item_title: item.title,
          item_url: item.url,
          item_image_url: item.image_url || null,
          item_price: item.approx_price ?? null,
          item_currency: item.currency || 'USD',
          notes: notes?.trim() || null,
          purchased_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return { purchase: null, error: new Error(error.message) };
      }

      return { purchase: data as PrivatePurchase, error: null };
    } catch (e: any) {
      return { purchase: null, error: e };
    }
  },

  /**
   * Unmarks a purchase (deletes the private purchase record).
   */
  async unmarkAsPurchased(purchaseId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('private_purchases')
        .delete()
        .eq('id', purchaseId);

      if (error) {
        return { error: new Error(error.message) };
      }

      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  },

  /**
   * Updates private notes on a purchase record.
   */
  async updatePurchaseNotes(
    purchaseId: string,
    notes: string
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('private_purchases')
        .update({
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchaseId);

      if (error) {
        return { error: new Error(error.message) };
      }

      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  },
};
