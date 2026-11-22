-- Migration: Add partner recipient, custom name, and color code to occasions table
-- Makes occasions creator-centric (shopper sets gift dates for their partners)

ALTER TABLE public.occasions
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS color_code TEXT DEFAULT '#6366F1';

-- Update index for recipient lookups
CREATE INDEX IF NOT EXISTS idx_occasions_recipient ON public.occasions(recipient_user_id);

-- Ensure RLS on occasions is private to the owner (shopper)
DROP POLICY IF EXISTS "Viewer can view shared occasions" ON public.occasions;

-- Drop and recreate owner policy to ensure full CRUD access
DROP POLICY IF EXISTS "Owner can manage own occasions" ON public.occasions;
CREATE POLICY "Owner can manage own occasions"
  ON public.occasions FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);
