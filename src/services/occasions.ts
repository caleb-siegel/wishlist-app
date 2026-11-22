import { supabase } from '@/lib/supabase';
import { Occasion, Profile, WishlistShare } from '@/types/database.types';
import { NotificationService } from './notifications';

export const OCCASION_COLORS = [
  '#6366F1', // Indigo
  '#EC4899', // Pink / Rose
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#3B82F6', // Blue
];

export interface ConnectedPartner {
  userId: string;
  displayName: string;
  colorCode: string;
}

export const OccasionsService = {
  /**
   * Fetches all occasions created by the shopper (including recipient profile & color).
   */
  async getMyOccasions(userId: string): Promise<{ occasions: Occasion[]; error: Error | null }> {
    try {
      const { data: occasions, error: occError } = await supabase
        .from('occasions')
        .select('*')
        .eq('owner_user_id', userId)
        .order('date', { ascending: true });

      if (occError) {
        return { occasions: [], error: new Error(occError.message) };
      }

      if (!occasions || occasions.length === 0) {
        return { occasions: [], error: null };
      }

      // Enrich with recipient profile if recipient_user_id is set
      const enriched: Occasion[] = await Promise.all(
        (occasions as Occasion[]).map(async (occ) => {
          if (occ.recipient_user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', occ.recipient_user_id)
              .maybeSingle();

            return {
              ...occ,
              recipient_profile: (profile as Profile) || undefined,
            };
          }
          return occ;
        })
      );

      return { occasions: enriched, error: null };
    } catch (e: any) {
      return { occasions: [], error: e };
    }
  },

  /**
   * Fetches partners whose wishlists are shared with the current user.
   */
  async getConnectedPartners(currentUserId: string): Promise<{ partners: ConnectedPartner[]; error: Error | null }> {
    try {
      // Find all active shares where current user is viewer OR owner
      const { data: shares, error: shareError } = await supabase
        .from('wishlist_shares')
        .select('owner_user_id, viewer_user_id')
        .or(`viewer_user_id.eq.${currentUserId},owner_user_id.eq.${currentUserId}`)
        .eq('status', 'active');

      if (shareError) {
        console.warn('Error fetching shares in getConnectedPartners:', shareError);
        return { partners: [], error: new Error(shareError.message) };
      }

      if (!shares || shares.length === 0) {
        return { partners: [], error: null };
      }

      // Collect unique partner IDs (the other user in the share)
      const partnerUserIds = Array.from(
        new Set(
          shares.map((s) => (s.owner_user_id === currentUserId ? s.viewer_user_id : s.owner_user_id))
        )
      );

      // Fetch profiles for each partner
      const partners: ConnectedPartner[] = await Promise.all(
        partnerUserIds.map(async (partnerId, index) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name')
            .eq('id', partnerId)
            .maybeSingle();

          return {
            userId: partnerId,
            displayName: profile?.display_name || 'Partner',
            colorCode: OCCASION_COLORS[index % OCCASION_COLORS.length],
          };
        })
      );

      return { partners, error: null };
    } catch (e: any) {
      console.warn('Exception in getConnectedPartners:', e);
      return { partners: [], error: e };
    }
  },

  /**
   * Creates an occasion for a partner (or self) and schedules a 1-month reminder for the shopper.
   */
  async createOccasion(data: {
    owner_user_id: string; // The shopper/creator
    recipient_user_id?: string | null;
    recipient_name?: string | null;
    color_code?: string;
    name: string;
    date: string; // YYYY-MM-DD
    recurs_annually: boolean;
    timezone?: string;
  }): Promise<{ occasion: Occasion | null; error: Error | null }> {
    try {
      const timezone =
        data.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        'America/New_York';

      const colorCode = data.color_code || OCCASION_COLORS[0];

      const { data: occasion, error: occError } = await supabase
        .from('occasions')
        .insert({
          owner_user_id: data.owner_user_id,
          recipient_user_id: data.recipient_user_id || null,
          recipient_name: data.recipient_name ? data.recipient_name.trim() : null,
          color_code: colorCode,
          name: data.name.trim(),
          date: data.date,
          recurs_annually: data.recurs_annually,
          timezone,
          enabled: true,
        })
        .select()
        .single();

      if (occError) {
        return { occasion: null, error: new Error(occError.message) };
      }

      // Add a 1-month-prior reminder for the shopper themselves
      await supabase.from('occasion_reminders').insert({
        occasion_id: occasion.id,
        viewer_user_id: data.owner_user_id,
        lead_time: 'one_month' as const,
        enabled: true,
      });

      return { occasion: occasion as Occasion, error: null };
    } catch (e: any) {
      return { occasion: null, error: e };
    }
  },

  /**
   * Deletes an occasion.
   */
  async deleteOccasion(occasionId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('occasions')
        .delete()
        .eq('id', occasionId);

      if (error) {
        return { error: new Error(error.message) };
      }

      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  },

  /**
   * Sends an immediate test reminder to the current device.
   */
  async triggerTestReminder(recipientName: string, occasionName: string) {
    await NotificationService.triggerLocalTestNotification(
      `Upcoming: ${recipientName}'s ${occasionName}`,
      `${recipientName}'s ${occasionName} is in 1 month! Check their gift wishlist.`,
      { type: 'occasion_reminder' }
    );
  },
};
