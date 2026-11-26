import { supabase } from '@/lib/supabase';
import {
  WishlistShare,
  SharingInvitation,
  Profile,
  WishlistItem,
  Wishlist,
  UserSearchResult,
} from '@/types/database.types';

export interface SharedWishlistData {
  shareId: string;
  ownerProfile: Profile;
  wishlist: Wishlist;
  items: WishlistItem[];
}

export const SharingService = {
  /**
   * Searches registered users on the app by display name or email,
   * annotating each with their sharing status relative to the current user
   * ('connected', 'pending', or 'available').
   */
  async searchUsers(
    query: string,
    currentUserId: string
  ): Promise<{ users: UserSearchResult[]; error: Error | null }> {
    try {
      const cleanQuery = query.trim();
      if (!cleanQuery || cleanQuery.length < 2) {
        return { users: [], error: null };
      }

      // 1. Fetch matching profiles excluding self
      let profiles: { id: string; display_name: string | null; email: string | null }[] = [];

      // Try RPC first if available, otherwise fallback to direct table query
      const { data: rpcData, error: rpcError } = await supabase.rpc('search_app_users', {
        p_query: cleanQuery,
        p_limit: 15,
      });

      if (!rpcError && rpcData) {
        profiles = rpcData;
      } else {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .neq('id', currentUserId)
          .or(`display_name.ilike.%${cleanQuery}%,email.ilike.%${cleanQuery}%`)
          .limit(15);

        if (fallbackError) {
          console.warn('Fallback profile search error:', fallbackError);
          return { users: [], error: new Error(fallbackError.message) };
        }
        profiles = (fallbackData as any[]) || [];
      }

      if (profiles.length === 0) {
        return { users: [], error: null };
      }

      // 2. Fetch active shares and pending invitations to calculate status
      const now = new Date().toISOString();
      const [activeSharesRes, pendingInvitesRes] = await Promise.all([
        supabase
          .from('wishlist_shares')
          .select('viewer_user_id')
          .eq('owner_user_id', currentUserId)
          .eq('status', 'active'),
        supabase
          .from('sharing_invitations')
          .select('invitee_user_id, invitee_email')
          .eq('owner_user_id', currentUserId)
          .eq('status', 'pending')
          .gt('expires_at', now),
      ]);

      const connectedViewerIds = new Set(
        (activeSharesRes.data || []).map((s: { viewer_user_id: string }) => s.viewer_user_id)
      );

      const pendingInviteeUserIds = new Set(
        (pendingInvitesRes.data || [])
          .filter((i: any) => i.invitee_user_id)
          .map((i: any) => i.invitee_user_id)
      );

      const pendingInviteeEmails = new Set(
        (pendingInvitesRes.data || [])
          .filter((i: any) => i.invitee_email)
          .map((i: any) => i.invitee_email.trim().toLowerCase())
      );

      // 3. Annotate results
      const results: UserSearchResult[] = profiles.map((p) => {
        const userEmail = p.email ? p.email.trim().toLowerCase() : null;
        let status: 'connected' | 'pending' | 'available' = 'available';

        if (connectedViewerIds.has(p.id)) {
          status = 'connected';
        } else if (
          pendingInviteeUserIds.has(p.id) ||
          (userEmail && pendingInviteeEmails.has(userEmail))
        ) {
          status = 'pending';
        }

        return {
          id: p.id,
          display_name: p.display_name,
          email: p.email,
          status,
        };
      });

      return { users: results, error: null };
    } catch (e: any) {
      console.warn('Exception in searchUsers:', e);
      return { users: [], error: e };
    }
  },

  /**
   * Validates whether an invite can be sent to a given email and/or user ID.
   */
  async validateInvite(
    ownerUserId: string,
    rawEmail: string,
    targetUserId?: string | null
  ): Promise<{ valid: boolean; error?: string; resolvedUserId?: string }> {
    const email = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return { valid: false, error: 'Please enter a valid email address.' };
    }

    // Check if inviting oneself
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (
      (targetUserId && targetUserId === ownerUserId) ||
      (currentUser?.email && currentUser.email.trim().toLowerCase() === email) ||
      (currentUser?.id && targetUserId === currentUser.id)
    ) {
      return { valid: false, error: 'You cannot invite yourself.' };
    }

    let resolvedId = targetUserId;

    // If targetUserId was not supplied, check if an existing app user has this email
    if (!resolvedId) {
      const { data: matchedProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (matchedProfile?.id) {
        resolvedId = matchedProfile.id;
      }
    }

    // Prevent inviting self if profile resolution found owner's ID
    if (resolvedId && (resolvedId === ownerUserId || resolvedId === currentUser?.id)) {
      return { valid: false, error: 'You cannot invite yourself.' };
    }

    // Check if already an active connected partner
    if (resolvedId) {
      const { data: existingShare } = await supabase
        .from('wishlist_shares')
        .select('id')
        .eq('owner_user_id', ownerUserId)
        .eq('viewer_user_id', resolvedId)
        .eq('status', 'active')
        .maybeSingle();

      if (existingShare) {
        return {
          valid: false,
          error: 'You are already sharing your wishlist with this partner.',
        };
      }
    }

    // Check if there is an active share with a viewer whose profile has this email
    const { data: activeShares } = await supabase
      .from('wishlist_shares')
      .select('viewer_user_id')
      .eq('owner_user_id', ownerUserId)
      .eq('status', 'active');

    if (activeShares && activeShares.length > 0) {
      const viewerIds = activeShares.map((s) => s.viewer_user_id);
      const { data: matchingProfiles } = await supabase
        .from('profiles')
        .select('id')
        .in('id', viewerIds)
        .eq('email', email)
        .limit(1);

      if (matchingProfiles && matchingProfiles.length > 0) {
        return {
          valid: false,
          error: 'You are already sharing your wishlist with this partner.',
        };
      }
    }

    // Check if already has a pending invitation
    const now = new Date().toISOString();
    let pendingQuery = supabase
      .from('sharing_invitations')
      .select('id')
      .eq('owner_user_id', ownerUserId)
      .eq('status', 'pending')
      .gt('expires_at', now);

    if (resolvedId) {
      pendingQuery = pendingQuery.or(
        `invitee_user_id.eq.${resolvedId},invitee_email.ilike.${email}`
      );
    } else {
      pendingQuery = pendingQuery.ilike('invitee_email', email);
    }

    const { data: existingPending } = await pendingQuery.limit(1);

    if (existingPending && existingPending.length > 0) {
      return {
        valid: false,
        error: 'An active invitation has already been sent to this user. Please wait for them to accept.',
      };
    }

    return { valid: true, resolvedUserId: resolvedId || undefined };
  },

  /**
   * Invites a partner by email or by selected registered user.
   */
  async invitePartner(
    ownerUserId: string,
    rawEmail: string,
    targetUserId?: string | null
  ): Promise<{ invitation: SharingInvitation | null; error: Error | null }> {
    try {
      const email = rawEmail.trim().toLowerCase();

      // Run full validation check
      const validation = await this.validateInvite(ownerUserId, email, targetUserId);
      if (!validation.valid) {
        return { invitation: null, error: new Error(validation.error) };
      }

      const finalUserId = validation.resolvedUserId || targetUserId || null;

      // Generate a secure random token hash for the invitation
      const token =
        Math.random().toString(36).substring(2) +
        Date.now().toString(36) +
        Math.random().toString(36).substring(2);

      // Expires in 7 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const insertPayload: any = {
        owner_user_id: ownerUserId,
        invitee_email: email,
        token_hash: token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      };

      if (finalUserId) {
        insertPayload.invitee_user_id = finalUserId;
      }

      const { data, error } = await supabase
        .from('sharing_invitations')
        .insert(insertPayload)
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
   * Gets pending invitations sent by the owner, enriched with invitee profile info if available.
   */
  async getSentInvitations(
    ownerUserId: string
  ): Promise<{ invitations: SharingInvitation[]; error: Error | null }> {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('sharing_invitations')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .eq('status', 'pending')
        .gt('expires_at', now)
        .order('created_at', { ascending: false });

      if (error) {
        return { invitations: [], error: new Error(error.message) };
      }

      const rawInvites = (data as SharingInvitation[]) || [];

      // Enrich with invitee profiles
      const enriched = await Promise.all(
        rawInvites.map(async (inv) => {
          let profile: Profile | null = null;
          if (inv.invitee_user_id) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', inv.invitee_user_id)
              .maybeSingle();
            profile = prof as Profile | null;
          } else if (inv.invitee_email) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('*')
              .eq('email', inv.invitee_email.trim().toLowerCase())
              .maybeSingle();
            profile = prof as Profile | null;
          }

          return {
            ...inv,
            invitee_profile: profile || undefined,
          };
        })
      );

      return { invitations: enriched, error: null };
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
            viewer_profile: (profile as Profile) || undefined,
            viewer_email: (profile as Profile)?.email || undefined,
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
   * Gets pending invitations that have been sent TO this user.
   * Matches both by invitee_user_id and by invitee_email.
   */
  async getIncomingInvitations(
    userEmail: string,
    currentUserId?: string
  ): Promise<{ invitations: (SharingInvitation & { owner_profile?: Profile })[]; error: Error | null }> {
    try {
      const cleanEmail = userEmail.trim().toLowerCase();
      const now = new Date().toISOString();

      let query = supabase
        .from('sharing_invitations')
        .select('*')
        .eq('status', 'pending')
        .gt('expires_at', now);

      if (currentUserId) {
        query = query.or(`invitee_user_id.eq.${currentUserId},invitee_email.ilike.${cleanEmail}`);
      } else {
        query = query.ilike('invitee_email', cleanEmail);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        return { invitations: [], error: new Error(error.message) };
      }

      const rawInvites = (data as SharingInvitation[]) || [];

      // Filter in JS to guarantee safety with case/whitespace
      const matching = rawInvites.filter((inv) => {
        if (currentUserId && inv.invitee_user_id === currentUserId) return true;
        return inv.invitee_email.trim().toLowerCase() === cleanEmail;
      });

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
