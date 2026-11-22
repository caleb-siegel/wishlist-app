import { supabase } from '@/lib/supabase';
import { Occasion, OccasionReminder, Profile } from '@/types/database.types';
import { NotificationService } from './notifications';

export interface OccasionWithReminders extends Occasion {
  reminders: (OccasionReminder & { viewer_profile?: Profile })[];
}

export interface PartnerOccasion extends Occasion {
  owner_profile?: Profile;
}

export const OccasionsService = {
  /**
   * Fetches all occasions created by the user, with configured reminders.
   */
  async getMyOccasions(ownerUserId: string): Promise<{ occasions: OccasionWithReminders[]; error: Error | null }> {
    try {
      const { data: occasions, error: occError } = await supabase
        .from('occasions')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .order('date', { ascending: true });

      if (occError) {
        return { occasions: [], error: new Error(occError.message) };
      }

      if (!occasions || occasions.length === 0) {
        return { occasions: [], error: null };
      }

      // Fetch reminders for each occasion
      const enriched: OccasionWithReminders[] = [];

      for (const occ of occasions as Occasion[]) {
        const { data: reminders } = await supabase
          .from('occasion_reminders')
          .select('*')
          .eq('occasion_id', occ.id);

        const enrichedReminders = await Promise.all(
          ((reminders as OccasionReminder[]) || []).map(async (rem) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', rem.viewer_user_id)
              .maybeSingle();

            return {
              ...rem,
              viewer_profile: (profile as Profile) || undefined,
            };
          })
        );

        enriched.push({
          ...occ,
          reminders: enrichedReminders,
        });
      }

      return { occasions: enriched, error: null };
    } catch (e: any) {
      return { occasions: [], error: e };
    }
  },

  /**
   * Creates a new occasion with optional partner reminders.
   */
  async createOccasion(data: {
    owner_user_id: string;
    name: string;
    date: string; // YYYY-MM-DD
    recurs_annually: boolean;
    timezone?: string;
    viewerIdsForReminders?: string[];
  }): Promise<{ occasion: Occasion | null; error: Error | null }> {
    try {
      const timezone =
        data.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        'America/New_York';

      const { data: occasion, error: occError } = await supabase
        .from('occasions')
        .insert({
          owner_user_id: data.owner_user_id,
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

      // Add reminders for selected viewers
      if (data.viewerIdsForReminders && data.viewerIdsForReminders.length > 0) {
        const reminderInserts = data.viewerIdsForReminders.map((viewerId) => ({
          occasion_id: occasion.id,
          viewer_user_id: viewerId,
          lead_time: 'one_month' as const,
          enabled: true,
        }));

        await supabase.from('occasion_reminders').insert(reminderInserts);
      }

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
   * Gets occasions belonging to connected partners.
   */
  async getPartnerOccasions(viewerUserId: string): Promise<{ occasions: PartnerOccasion[]; error: Error | null }> {
    try {
      // Find active shares where user is viewer
      const { data: shares, error: shareError } = await supabase
        .from('wishlist_shares')
        .select('owner_user_id')
        .eq('viewer_user_id', viewerUserId)
        .eq('status', 'active');

      if (shareError) {
        return { occasions: [], error: new Error(shareError.message) };
      }

      if (!shares || shares.length === 0) {
        return { occasions: [], error: null };
      }

      const ownerIds = shares.map((s) => s.owner_user_id);

      const { data: occasions, error: occError } = await supabase
        .from('occasions')
        .select('*')
        .in('owner_user_id', ownerIds)
        .eq('enabled', true)
        .order('date', { ascending: true });

      if (occError) {
        return { occasions: [], error: new Error(occError.message) };
      }

      // Attach owner profiles
      const enriched = await Promise.all(
        ((occasions as Occasion[]) || []).map(async (occ) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', occ.owner_user_id)
            .maybeSingle();

          return {
            ...occ,
            owner_profile: (profile as Profile) || undefined,
          };
        })
      );

      return { occasions: enriched, error: null };
    } catch (e: any) {
      return { occasions: [], error: e };
    }
  },

  /**
   * Sends an immediate test reminder to the current device.
   */
  async triggerTestReminder(ownerName: string, occasionName: string) {
    await NotificationService.triggerLocalTestNotification(
      `Upcoming Occasion: ${occasionName}`,
      `${ownerName}'s ${occasionName} is in 1 month! Take a look at their gift wishlist.`,
      { type: 'occasion_reminder' }
    );
  },
};
