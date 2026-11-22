-- Migration: Add secure invitation acceptance and decline functions
-- Fixes RLS violation when a viewer accepts an invitation

CREATE OR REPLACE FUNCTION public.accept_sharing_invitation(p_invitation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_invite public.sharing_invitations%ROWTYPE;
  v_user_email TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_user_email := lower(trim(auth.jwt()->>'email'));

  SELECT * INTO v_invite
  FROM public.sharing_invitations
  WHERE id = p_invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF lower(trim(v_invite.invitee_email)) != v_user_email THEN
    RAISE EXCEPTION 'This invitation was sent to %, but you are signed in as %', v_invite.invitee_email, v_user_email;
  END IF;

  IF v_invite.status != 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer pending (status: %)', v_invite.status;
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.sharing_invitations SET status = 'expired' WHERE id = p_invitation_id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- 1. Mark invitation accepted
  UPDATE public.sharing_invitations
  SET status = 'accepted', accepted_by_user_id = v_user_id, updated_at = now()
  WHERE id = p_invitation_id;

  -- 2. Create or reactivate active share
  INSERT INTO public.wishlist_shares (owner_user_id, viewer_user_id, status, revoked_at)
  VALUES (v_invite.owner_user_id, v_user_id, 'active', null)
  ON CONFLICT (owner_user_id, viewer_user_id)
  DO UPDATE SET status = 'active', revoked_at = null;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.decline_sharing_invitation(p_invitation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  v_user_email := lower(trim(auth.jwt()->>'email'));

  UPDATE public.sharing_invitations
  SET status = 'revoked', updated_at = now()
  WHERE id = p_invitation_id
    AND lower(trim(invitee_email)) = v_user_email
    AND status = 'pending';

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
