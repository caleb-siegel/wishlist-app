-- Migration: User Search, Internal Mapping, and Sharing Validation
-- 1. Add email column to profiles and index it
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(lower(trim(email)));
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(lower(trim(display_name)));

-- Backfill emails from auth.users into profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- 2. Update handle_new_user trigger to save email into profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, timezone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'America/New_York')
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email);
  
  -- Also create default wishlist for the new user
  INSERT INTO public.wishlists (owner_user_id, name)
  VALUES (NEW.id, 'My Wishlist')
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add invitee_user_id to sharing_invitations for internal mapping
ALTER TABLE public.sharing_invitations
  ADD COLUMN IF NOT EXISTS invitee_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_invitations_invitee_user ON public.sharing_invitations(invitee_user_id);

-- 4. Update RLS on profiles to allow authenticated users to search and discover users
DROP POLICY IF EXISTS "Users can view connected partners profile" ON public.profiles;
CREATE POLICY "Users can search and view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 5. Update RLS on sharing_invitations to allow invitees to view their invites by invitee_user_id or email
DROP POLICY IF EXISTS "Invitee can view invitations by email" ON public.sharing_invitations;
CREATE POLICY "Invitee can view invitations"
  ON public.sharing_invitations FOR SELECT
  USING (
    auth.uid() = owner_user_id OR
    auth.uid() = invitee_user_id OR
    lower(trim(invitee_email)) = lower(trim(auth.jwt()->>'email'))
  );

-- 6. Helper function for searching app users
CREATE OR REPLACE FUNCTION public.search_app_users(p_query TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.display_name, p.email
  FROM public.profiles p
  WHERE p.id != auth.uid()
    AND (
      p.display_name ILIKE ('%' || p_query || '%')
      OR p.email ILIKE ('%' || p_query || '%')
    )
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update accept_sharing_invitation to support invitee_user_id mapping
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

  -- Validate that invitation was meant for this user (either user ID matches or email matches)
  IF (v_invite.invitee_user_id IS NOT NULL AND v_invite.invitee_user_id != v_user_id)
     AND (lower(trim(v_invite.invitee_email)) != v_user_email) THEN
    RAISE EXCEPTION 'This invitation was not sent to you.';
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

-- 8. Update decline_sharing_invitation to support invitee_user_id mapping
CREATE OR REPLACE FUNCTION public.decline_sharing_invitation(p_invitation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_email TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_user_email := lower(trim(auth.jwt()->>'email'));

  UPDATE public.sharing_invitations
  SET status = 'revoked', updated_at = now()
  WHERE id = p_invitation_id
    AND (
      invitee_user_id = v_user_id
      OR lower(trim(invitee_email)) = v_user_email
    )
    AND status = 'pending';

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
