-- Supabase Initial Schema for Shared Gift Wishlist
-- Compatible with Postgres 15+ with Row Level Security (RLS)

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, timezone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'America/New_York')
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Also create default wishlist for the new user
  INSERT INTO public.wishlists (owner_user_id, name)
  VALUES (NEW.id, 'My Wishlist');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Wishlists table
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Wishlist',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for new user profile + default wishlist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Wishlist Items table
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id UUID NOT NULL REFERENCES public.wishlists(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  approx_price NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  preference_level TEXT NOT NULL DEFAULT 'would_love' CHECK (preference_level IN ('would_love', 'just_an_idea')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Wishlist Shares table (Active owner-viewer pairs)
CREATE TABLE IF NOT EXISTS public.wishlist_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT unique_owner_viewer_pair UNIQUE (owner_user_id, viewer_user_id)
);

-- 5. Sharing Invitations table
CREATE TABLE IF NOT EXISTS public.sharing_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Private Purchases table (CRITICAL PRIVACY BOUNDARY: Viewer only, recipient NEVER sees this)
CREATE TABLE IF NOT EXISTS public.private_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopper_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_item_id UUID REFERENCES public.wishlist_items(id) ON DELETE SET NULL,
  item_title TEXT NOT NULL,
  item_url TEXT NOT NULL,
  item_image_url TEXT,
  item_price NUMERIC(10,2),
  item_currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Occasions table
CREATE TABLE IF NOT EXISTS public.occasions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  recurs_annually BOOLEAN NOT NULL DEFAULT true,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Occasion Reminders table
CREATE TABLE IF NOT EXISTS public.occasion_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id UUID NOT NULL REFERENCES public.occasions(id) ON DELETE CASCADE,
  viewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_time TEXT NOT NULL DEFAULT 'one_month' CHECK (lead_time IN ('one_month')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_occasion_viewer_lead UNIQUE (occasion_id, viewer_user_id, lead_time)
);

-- 9. Push Devices table
CREATE TABLE IF NOT EXISTS public.push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_push_token UNIQUE (user_id, expo_push_token)
);

-- 10. Notification Deliveries table (for idempotency and deduping)
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id UUID NOT NULL REFERENCES public.occasions(id) ON DELETE CASCADE,
  viewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurrence_year INT NOT NULL,
  lead_time TEXT NOT NULL DEFAULT 'one_month',
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider_ticket TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_notification_delivery UNIQUE (occasion_id, viewer_user_id, occurrence_year, lead_time)
);

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sharing_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occasions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occasion_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view connected partners profile"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.wishlist_shares
      WHERE status = 'active'
      AND ((owner_user_id = auth.uid() AND viewer_user_id = public.profiles.id)
        OR (viewer_user_id = auth.uid() AND owner_user_id = public.profiles.id))
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 2. Wishlists Policies
CREATE POLICY "Owner can manage own wishlist"
  ON public.wishlists FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Viewer can view shared wishlists"
  ON public.wishlists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.wishlist_shares
      WHERE owner_user_id = public.wishlists.owner_user_id
        AND viewer_user_id = auth.uid()
        AND status = 'active'
    )
  );

-- 3. Wishlist Items Policies
CREATE POLICY "Owner can manage own wishlist items"
  ON public.wishlist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.wishlists
      WHERE id = public.wishlist_items.wishlist_id
        AND owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.wishlists
      WHERE id = public.wishlist_items.wishlist_id
        AND owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Viewer can view shared wishlist items"
  ON public.wishlist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.wishlists w
      JOIN public.wishlist_shares s ON s.owner_user_id = w.owner_user_id
      WHERE w.id = public.wishlist_items.wishlist_id
        AND s.viewer_user_id = auth.uid()
        AND s.status = 'active'
    )
  );

-- 4. Wishlist Shares Policies
CREATE POLICY "Users can view shares they participate in"
  ON public.wishlist_shares FOR SELECT
  USING (auth.uid() = owner_user_id OR auth.uid() = viewer_user_id);

CREATE POLICY "Owner can manage shares"
  ON public.wishlist_shares FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- 5. Sharing Invitations Policies
CREATE POLICY "Owner can manage invitations"
  ON public.sharing_invitations FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Invitee can view invitations by email"
  ON public.sharing_invitations FOR SELECT
  USING (
    lower(trim(invitee_email)) = lower(trim(auth.jwt()->>'email'))
  );

-- 6. Private Purchases Policies (CRITICAL: ABSOLUTE ISOLATION)
CREATE POLICY "Shopper can do everything with their own purchases"
  ON public.private_purchases FOR ALL
  USING (auth.uid() = shopper_user_id)
  WITH CHECK (auth.uid() = shopper_user_id);

-- 7. Occasions Policies
CREATE POLICY "Owner can manage own occasions"
  ON public.occasions FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Viewer can view shared occasions"
  ON public.occasions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.wishlist_shares
      WHERE owner_user_id = public.occasions.owner_user_id
        AND viewer_user_id = auth.uid()
        AND status = 'active'
    )
  );

-- 8. Occasion Reminders Policies
CREATE POLICY "Owner or viewer can view reminders"
  ON public.occasion_reminders FOR SELECT
  USING (
    auth.uid() = viewer_user_id OR
    EXISTS (
      SELECT 1 FROM public.occasions
      WHERE id = public.occasion_reminders.occasion_id
        AND owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can manage reminders"
  ON public.occasion_reminders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.occasions
      WHERE id = public.occasion_reminders.occasion_id
        AND owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.occasions
      WHERE id = public.occasion_reminders.occasion_id
        AND owner_user_id = auth.uid()
    )
  );

-- 9. Push Devices Policies
CREATE POLICY "Users can manage own push devices"
  ON public.push_devices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 10. Notification Deliveries Policies
CREATE POLICY "Users can view deliveries meant for them"
  ON public.notification_deliveries FOR SELECT
  USING (auth.uid() = viewer_user_id);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_wishlists_owner ON public.wishlists(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_items_wishlist ON public.wishlist_items(wishlist_id);
CREATE INDEX IF NOT EXISTS idx_shares_owner ON public.wishlist_shares(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_shares_viewer ON public.wishlist_shares(viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.sharing_invitations(lower(trim(invitee_email)));
CREATE INDEX IF NOT EXISTS idx_private_purchases_shopper ON public.private_purchases(shopper_user_id);
CREATE INDEX IF NOT EXISTS idx_occasions_owner ON public.occasions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_occasion ON public.occasion_reminders(occasion_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_user ON public.push_devices(user_id);
