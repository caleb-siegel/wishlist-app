# Shared Gift Wishlist (Mobile App)

A modern, cross-platform iOS and Android mobile app built with **React Native (Expo SDK 58)**, **TypeScript**, **Swift / WidgetKit**, and **Supabase** (Postgres, Row Level Security, Auth, and Edge Functions).

The app enables users to curate personal gift wishlists, securely share them with a partner, mark gift ideas as purchased in complete secrecy from the recipient, manage recurring gift-giving occasions with automated 1-month-prior reminders, and glance at upcoming dates and gift ideas directly from the iOS Home Screen widget.

---

## Development Workflows: Expo Go vs. Development Client

There are two ways to run and develop this app locally. Choose the one that fits what you are working on:

| Workflow | Best For | Supports Home-Screen Widget? | How to Start Server |
| :--- | :--- | :---: | :--- |
| **1. Expo Go** | Rapid frontend & UI tweaks, quick testing | ❌ No (WidgetKit requires native Swift) | `npm run start` |
| **2. Development Client** | Real device testing, WidgetKit, deep links | ✅ Yes (Compiled with Swift extension) | `npx expo start --dev-client` |

---

### Workflow 1: Rapid Development with Expo Go (Quick & Lightweight)

Use this when you want to quickly test screens, adjust styles, or tweak database queries without building native binaries:

1. **Start the Metro bundler on your computer:**
   ```bash
   npm run start
   ```
2. **Open on your phone:**
   - Launch the generic **Expo Go** app from the App Store.
   - Scan the QR code shown in your terminal.
3. **What works in Expo Go:**
   - Sign up / Sign in & encrypted session persistence
   - Creating, editing, and categorizing wishlist items
   - Automatic product link scraping (OpenGraph titles, prices, and images)
   - Inviting a partner and viewing their wishlist
   - Marking items as purchased in secret
   - Setting occasion countdowns and adjusting timezone settings

---

### Workflow 2: Development Build on Physical iPhone (With WidgetKit)

Use this when you want the app installed as its own dedicated icon on your iPhone, with the **Home-Screen Widget** enabled.

#### Step 1: Initial One-Time Build (Already Done)
To compile the custom native build with the Swift WidgetKit extension and Apple App Group:
```bash
npx eas-cli build --profile development --platform ios
```
*Note on setup prompts:*
- Apple Distribution Certificate: Choose **Yes** (EAS handles creation automatically)
- Apple Push Notifications (APNs): Choose **Yes**
- Register Device / UDID: Choose **Yes** and scan the QR code to install the Apple configuration profile

#### Step 2: One-Time iOS "Developer Mode" Activation
When you download an internal development build onto an iPhone running iOS 16 or newer, Apple requires enabling Developer Mode once:
1. Open the iPhone **Settings** app.
2. Go to **Privacy & Security**.
3. Scroll all the way to the bottom to **Security** and tap **Developer Mode**.
4. Toggle the switch to **ON**.
5. Tap **Restart** when prompted.
6. After your iPhone reboots and you unlock it, tap **Turn On** on the popup alert and enter your passcode.

#### Step 3: Day-to-Day Development with the Custom App
Every time you want to develop and test using your custom app:
1. Open your terminal in the project directory and run:
   ```bash
   npx expo start --dev-client
   ```
2. Tap the **Gift Wishlist** app icon on your iPhone.
3. It will automatically connect to your computer, load the JavaScript bundle, and support live hot-reloading!

#### Step 4: Adding the Home-Screen Widget on Your iPhone
1. Long-press on your iPhone Home Screen until the app icons start jiggling.
2. Tap the **`+`** button in the top-left corner.
3. Search for **Gift Wishlist**.
4. Swipe between:
   - **Small Widget:** Upcoming occasion countdown card with days remaining badge.
   - **Medium Widget:** Split-view card featuring the next upcoming occasion on the left and recent gift ideas on the right.
5. Tap **Add Widget**. Tapping on the widget launches the app directly into that tab!

---

## Distributing to Others via Apple TestFlight (100% Free)

You can share the app with friends, family, and your partner via Apple TestFlight. Up to 10,000 testers can install it without needing to register their device UDIDs or enable Developer Mode.

### 1. Create App in App Store Connect (One-Time)
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com).
2. Go to **Apps** ➔ click the **`+`** button ➔ **New App**.
3. Platform: **iOS**.
4. Name: `Gift Wishlist` (or your chosen unique name).
5. Bundle ID: Select `com.calebsiegel.wishlist`.
6. SKU: `wishlist-01`.
7. User Access: **Full Access**.

### 2. Trigger the TestFlight Build
Run this command in your computer terminal:
```bash
npx eas-cli build --profile production --platform ios --auto-submit
```
EAS builds the standalone production binary in the cloud and automatically submits it directly to TestFlight!

### 3. Invite Testers
1. In App Store Connect, open your app and go to the **TestFlight** tab.
2. Under **Internal Testing** or **External Testing**, add your email and your partner's/friends' emails.
3. Apple sends them an invitation email. They install the free **TestFlight** app from the App Store and tap **Install**!

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

## Testing Deep Links
Open Safari on your iOS device or simulator and type:
- `wishlist://occasions` -> opens Occasions tab
- `wishlist://my-list` -> opens My List tab
- `wishlist://shared` -> opens Shared Partner tab

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
