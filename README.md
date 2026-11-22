# Shared Gift Wishlist (Mobile App)

A modern, cross-platform iOS and Android mobile app built with **React Native (Expo SDK 58)**, **TypeScript**, **Swift / WidgetKit**, and **Supabase** (Postgres, Row Level Security, Auth, and Edge Functions).

The app enables users to curate personal gift wishlists, securely share them with a partner, mark gift ideas as purchased in complete secrecy from the recipient, manage recurring gift-giving occasions with automated 1-month-prior reminders, and glance at upcoming dates and gift ideas directly from the iOS Home Screen widget.

---

## Architecture & Milestones Completed

### Milestone 1: Foundation, Auth & Database Schema
- **Expo Router Architecture:** Protected file-based routing with session guards (`src/app/_layout.tsx`, `src/app/(auth)/`, `src/app/(app)/`).
- **Encrypted Session Persistence:** Configured with `expo-secure-store` ensuring secure authentication tokens in iOS Keychain and Android Keystore.
- **Supabase Postgres & Strict RLS:** All tables (`profiles`, `wishlist_items`, `wishlist_shares`, `sharing_invitations`, `private_purchases`, `occasions`, `occasion_reminders`, `notification_deliveries`, `push_devices`) secured with granular Row Level Security policies.
- **Cross-Account RPC Functions:** `accept_sharing_invitation` and `decline_sharing_invitation` security-definer database functions (`supabase/migrations/20241122000000_accept_invitation_function.sql`) for secure cross-user invitation management.

### Milestone 2: Owner Wishlist & Link Metadata Lookup
- **Item Management:** Full CRUD operations supporting item titles, URLs, notes, target prices, and preference classifications (*"Would love this"* vs *"Just an idea"*).
- **Fast Metadata Scraper:** Lightweight OpenGraph / HTML scraper (`src/services/metadata.ts`) with a strict 4.5-second timeout and fallback regex parsing to auto-fill title, price, and thumbnail image preview.
- **Preference Filter Chips:** Quick toggles on **My List** screen to filter items by preference and priority.

### Milestone 3: Sharing Flow & "Invisible" Shopper Purchases
- **Email Partner Invitations:** Invite a partner by email with secure random tokens. Accept / decline flow directly in the app.
- **Zero-Spoiler Purchase Vault:** `private_purchases` table is strictly segregated by RLS (`auth.uid() = shopper_user_id`). The wishlist owner never has read or write access to who bought what or private shopper notes.
- **Partner View & History:** Switch between viewing your partner's wishlist (with realtime purchase toggles) and viewing your own private purchase history.

### Milestone 4: Occasions & Push Reminders
- **Occasion Countdown Cards:** Track Birthdays, Anniversaries, Holidays, and custom occasions with days-remaining countdowns.
- **1-Month-Prior Calendar Clamping:** Robust date calculation (`src/utils/date-utils.ts`) handling leap years, variable month lengths (e.g., March 31 -> February 28/29), and annual recurrence.
- **Push Token Registration:** Automatic device token synchronization (`src/services/notifications.ts`) with `expo-notifications`.
- **Scheduled Edge Function:** Deployed Supabase Edge Function (`supabase/functions/send-reminders/index.ts`) for daily reminder dispatching via Expo Push Notification service with automatic delivery deduplication.

### Milestone 5: Home-Screen Widget (WidgetKit) & Deep Linking
- **Native iOS WidgetKit Target:** Swift & SwiftUI implementation (`targets/widget/index.swift` and `targets/widget/expo-target.config.js`) via `@bacons/apple-targets`.
  - **Small Widget (`.systemSmall`):** Clean upcoming occasion countdown card with days remaining badge.
  - **Medium Widget (`.systemMedium`):** Split-view card featuring the next upcoming occasion on the left and recent gift ideas on the right.
- **App Group Shared Container:** Synchronized JSON snapshot service (`src/services/widget.ts`) storing sanitized data in `UserDefaults(suiteName: "group.com.calebsiegel.wishlist")`.
  - *Privacy Guarantee:* Purchase records and secret shopper notes are strictly excluded from widget data snapshots.
- **Custom URL Scheme & Deep Linking:** Configured `wishlist://` scheme routing directly to tabs (`wishlist://occasions`, `wishlist://my-list`, `wishlist://shared`).

### Milestone 6: EAS Builds & Internal Distribution Setup
- **EAS Build Configuration:** Pre-configured `eas.json` with `development`, `development-simulator`, `preview`, and `production` profiles.
- **Custom Development Client:** Integrated `expo-dev-client` enabling native Swift extensions and entitlements on physical iOS devices.

---

## Project Structure

```
├── app.json                                 # Expo app configuration, App Groups & plugins
├── eas.json                                 # EAS build profiles (dev, simulator, preview, prod)
├── package.json
├── tsconfig.json
├── supabase/
│   ├── functions/
│   │   └── send-reminders/index.ts          # Deployed Edge Function for push reminders
│   └── migrations/
│       ├── 20241121000000_initial_schema.sql             # Full schema + RLS policies
│       └── 20241122000000_accept_invitation_function.sql # RPC invitation functions
├── targets/
│   └── widget/
│       ├── expo-target.config.js            # Apple target configuration (App Group)
│       └── index.swift                      # SwiftUI Small & Medium widget implementation
└── src/
    ├── app/
    │   ├── _layout.tsx                      # Root layout, AuthProvider, deep link listener
    │   ├── index.tsx                        # Root router redirect
    │   ├── (auth)/                          # Sign In / Sign Up screens
    │   └── (app)/                           # Authenticated screens
    │       ├── (tabs)/                      # My List, Shared, Occasions, Settings
    │       ├── add-item.tsx                 # Add gift item modal with auto-scraper
    │       ├── edit-item.tsx                # Edit gift item modal
    │       ├── add-occasion.tsx             # Add occasion modal
    │       ├── invite-modal.tsx             # Invite partner modal
    │       └── purchase-modal.tsx           # Mark item as purchased modal
    ├── context/
    │   └── auth.tsx                         # Supabase Auth Provider & state
    ├── lib/
    │   └── supabase.ts                      # Supabase client with SecureStore
    ├── services/
    │   ├── wishlist.ts                      # Wishlist item CRUD
    │   ├── metadata.ts                      # OpenGraph & price scraper
    │   ├── sharing.ts                       # Sharing & invitation management
    │   ├── purchases.ts                     # Invisible purchase vault
    │   ├── occasions.ts                     # Occasions & reminder settings
    │   ├── notifications.ts                 # Push device token registration
    │   └── widget.ts                        # Native widget snapshot synchronizer
    └── utils/
        └── date-utils.ts                    # 1-month-prior calendar clamping math
```

---

## Running Locally

### Development with Expo Go (Quick UI Testing)
```bash
npm run start
```
- Open **Expo Go** on your iPhone or Android device and scan the terminal QR code.
- Test wishlists, metadata scraping, partner invitations, and occasion countdowns.

### Testing Deep Links
Open Safari on your iOS device or simulator and type:
- `wishlist://occasions` -> opens Occasions tab
- `wishlist://my-list` -> opens My List tab
- `wishlist://shared` -> opens Shared Partner tab

---

## Building Native App & Widget (EAS Build)

Because Home Screen widgets require native iOS Swift extension binaries, they run in a custom Development Client build rather than generic Expo Go:

### 1. Build Development Client for iOS
```bash
# Build for your registered physical iPhone (Ad-Hoc / Internal)
npx eas-cli build --profile development --platform ios

# Or build for iOS Simulator
npx eas-cli build --profile development-simulator --platform ios
```

### 2. Run Local Development Server
```bash
npx expo start --dev-client
```
Install the resulting `.ipa` or simulator `.app`, open it, and sign in.

### 3. Add Home Screen Widget
1. Long-press on your iPhone Home Screen until apps jiggle.
2. Tap the **`+`** icon in the top corner.
3. Search for **Gift Wishlist**.
4. Choose either the **Small** (Next Occasion Countdown) or **Medium** (Split View Countdown + Gift Ideas) widget.
5. Tap **Add Widget**. Tapping on the widget launches the app directly into the corresponding tab!

---

## Scheduled Reminders Setup (pg_cron)

The `send-reminders` Supabase Edge Function is deployed to your Supabase project. To run it automatically every day at 9:00 AM UTC:

In your Supabase SQL Editor:
```sql
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily reminder run at 9:00 AM UTC
SELECT cron.schedule(
  'daily-wishlist-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ifalzylyjuroqlicfyge.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
```
