import { supabase } from '@/lib/supabase';
import { WishlistShare, SharingInvitation, Profile, WishlistItem, Wishlist } from '@/types/database.types';

export interface SharedWishlistData {
  shareId: string;
  ownerProfile: Profile;
  wishlist: Wishlist;
  items: WishlistItem[];
}

export const SharingService = {
  /**
   * Invites a partner by email.
   */
  async invitePartner(
    ownerUserId: string,
    rawEmail: string
  ): Promise<{ invitation: SharingInvitation | null; error: Error | null }> {
    try {
      const email = rawEmail.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return { invitation: null, error: new Error('Please enter a valid email address.') };
      }

      // Check if user is trying to invite themselves
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email && user.email.toLowerCase() === email) {
        return { invitation: null, error: new Error('You cannot invite yourself.') };
      }

      // Generate a random token hash for the invitation
      const token =
        Math.random().toString(36).substring(2) +
        Date.now().toString(36) +
        Math.random().toString(36).substring(2);

      // Expires in 7 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await supabase
        .from('sharing_invitations')
        .insert({
          owner_user_id: ownerUserId,
          invitee_email: email,
          token_hash: token,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        return { invitation: null, error: new Error(error.message) };
      }

      return { invitation: data as SharingInvitation, error: null };
    } catch (e: any) {
      return { invitation: null, error: e };
    }
  },

  /**
   * Gets pending invitations sent by the owner.
   */
  async getSentInvitations(
    ownerUserId: string
  ): Promise<{ invitations: SharingInvitation[]; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('sharing_invitations')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        return { invitations: [], error: new Error(error.message) };
      }

      return { invitations: (data as SharingInvitation[]) || [], error: null };
    } catch (e: any) {
      return { invitations: [], error: e };
    }
  },

  /**
   * Cancels a pending invitation.
   */
  async cancelInvitation(invitationId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('sharing_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);

      if (error) {
        return { error: new Error(error.message) };
      }
      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  },

  /**
   * Gets active shares where the user is the owner (people who have access to user's list).
   */
  async getActiveSharesAsOwner(
    ownerUserId: string
  ): Promise<{ shares: (WishlistShare & { viewer_email?: string })[]; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('wishlist_shares')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        return { shares: [], error: new Error(error.message) };
      }

      const shares = (data as WishlistShare[]) || [];

      // Fetch profiles of viewers
      const enriched = await Promise.all(
        shares.map(async (share) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', share.viewer_user_id)
            .maybeSingle();

          return {
            ...share,
            viewer_profile: profile as Profile,
          };
        })
      );

      return { shares: enriched, error: null };
    } catch (e: any) {
      return { shares: [], error: e };
    }
  },

  /**
   * Revokes a partner's access.
   */
  async revokeShare(shareId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('wishlist_shares')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
        })
        .eq('id', shareId);

      if (error) {
        return { error: new Error(error.message) };
      }
      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  },

  /**
   * Gets pending invitations that have been sent TO this user's email.
   */
  async getIncomingInvitations(
    userEmail: string
  ): Promise<{ invitations: (SharingInvitation & { owner_profile?: Profile })[]; error: Error | null }> {
    try {
      const cleanEmail = userEmail.trim().toLowerCase();
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('sharing_invitations')
        .select('*')
        .eq('status', 'pending')
        .gt('expires_at', now);

      if (error) {
        return { invitations: [], error: new Error(error.message) };
      }

      // Filter by email in case of whitespace/casing
      const matching = (data as SharingInvitation[]).filter(
        (inv) => inv.invitee_email.trim().toLowerCase() === cleanEmail
      );

      // Attach owner profiles
      const enriched = await Promise.all(
        matching.map(async (inv) => {
          const { data: ownerProf } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', inv.owner_user_id)
            .maybeSingle();

          return {
            ...inv,
            owner_profile: (ownerProf as Profile) || undefined,
          };
        })
      );

      return { invitations: enriched, error: null };
    } catch (e: any) {
      return { invitations: [], error: e };
    }
  },

  /**
   * Accepts an incoming invitation.
   */
  async acceptInvitation(
    invitation: SharingInvitation,
    _currentUserId: string
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.rpc('accept_sharing_invitation', {
        p_invitation_id: invitation.id,
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  },

  /**
   * Declines an incoming invitation.
   */
  async declineInvitation(invitationId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.rpc('decline_sharing_invitation', {
        p_invitation_id: invitationId,
      });

      if (error) {
        return { error: new Error(error.message) };
      }
      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  },

  /**
   * Fetches all wishlists shared with the user where status is 'active'.
   */
  async getSharedWithMe(viewerUserId: string): Promise<{ lists: SharedWishlistData[]; error: Error | null }> {
    try {
      // Get all active shares
      const { data: shares, error: shareError } = await supabase
        .from('wishlist_shares')
        .select('*')
        .eq('viewer_user_id', viewerUserId)
        .eq('status', 'active');

      if (shareError) {
        return { lists: [], error: new Error(shareError.message) };
      }

      if (!shares || shares.length === 0) {
        return { lists: [], error: null };
      }

      // For each share, fetch owner's profile, wishlist, and items
      const results: SharedWishlistData[] = [];

      for (const share of shares as WishlistShare[]) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', share.owner_user_id)
          .single();

        const { data: wishlist } = await supabase
          .from('wishlists')
          .select('*')
          .eq('owner_user_id', share.owner_user_id)
          .limit(1)
          .single();

        if (wishlist) {
          const { data: items } = await supabase
            .from('wishlist_items')
            .select('*')
            .eq('wishlist_id', wishlist.id)
            .order('created_at', { ascending: false });

          results.push({
            shareId: share.id,
            ownerProfile: ownerProfile as Profile,
            wishlist: wishlist as Wishlist,
            items: (items as WishlistItem[]) || [],
          });
        }
      }

      return { lists: results, error: null };
    } catch (e: any) {
      return { lists: [], error: e };
    }
  },
};
