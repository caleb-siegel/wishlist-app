export type PreferenceLevel = 'would_love' | 'just_an_idea';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type ShareStatus = 'active' | 'revoked';
export type ReminderLeadTime = 'one_month';
export type NotificationDeliveryStatus = 'pending' | 'sent' | 'failed';

export interface Profile {
  id: string; // matches auth.users.id
  display_name: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Wishlist {
  id: string;
  owner_user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface WishlistItem {
  id: string;
  wishlist_id: string;
  url: string;
  title: string;
  image_url: string | null;
  approx_price: number | null;
  currency: string;
  notes: string | null;
  preference_level: PreferenceLevel;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PrivatePurchase {
  id: string;
  shopper_user_id: string;
  source_item_id: string | null;
  item_title: string;
  item_url: string;
  item_image_url: string | null;
  item_price: number | null;
  item_currency: string;
  notes: string | null;
  purchased_at: string;
  created_at: string;
  updated_at: string;
}

export interface SharingInvitation {
  id: string;
  owner_user_id: string;
  invitee_email: string;
  token_hash: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WishlistShare {
  id: string;
  owner_user_id: string;
  viewer_user_id: string;
  status: ShareStatus;
  created_at: string;
  revoked_at: string | null;
  // joined fields
  owner_profile?: Profile;
  viewer_profile?: Profile;
}

export interface Occasion {
  id: string;
  owner_user_id: string;
  recipient_user_id: string | null;
  recipient_name: string | null;
  color_code: string;
  name: string;
  date: string; // YYYY-MM-DD
  recurs_annually: boolean;
  timezone: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  recipient_profile?: Profile;
}

export interface OccasionReminder {
  id: string;
  occasion_id: string;
  viewer_user_id: string;
  lead_time: ReminderLeadTime;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PushDevice {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: 'ios' | 'android' | 'web';
  last_seen_at: string;
  disabled_at: string | null;
  created_at: string;
}

export interface NotificationDelivery {
  id: string;
  occasion_id: string;
  viewer_user_id: string;
  occurrence_year: number;
  lead_time: ReminderLeadTime;
  scheduled_for: string;
  sent_at: string | null;
  status: NotificationDeliveryStatus;
  provider_ticket: string | null;
  error_code: string | null;
  created_at: string;
}
