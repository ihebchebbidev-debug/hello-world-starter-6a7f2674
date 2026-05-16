# Firebase / FCM, Maps & EAS — Production Setup

This applies to **both** apps (`ecobus_parent-main` and `ecobus_driver-main`).
You only need to do this once per app, before your first production EAS build.

---

## 1. Firebase (FCM v1 — required for push on Android)

`expo-notifications` calls `getDevicePushTokenAsync()`, which on Android
returns a real **FCM token**. FCM v1 (the only API Google still accepts)
requires a `google-services.json` baked into the build.

### One-time, per app

1. Go to https://console.firebase.google.com → **Add project** (or use an existing one).
2. Add an **Android app**:
   - Parent package: `app.ecobus.parents`
   - Driver package: `app.ecobus.driver`
   - Download `google-services.json` and drop it at the **root of the app folder**
     (next to `app.json`). Already wired via `android.googleServicesFile`.
3. Add an **iOS app** with the matching bundle id, download
   `GoogleService-Info.plist`, drop it at the **root of the app folder**.
   Already wired via `ios.googleServicesFile`.
4. In Firebase Console → **Project settings → Service accounts**,
   click **Generate new private key**. This JSON is what your backend uses
   to send push via FCM v1 (`POST /v1/projects/{id}/messages:send`).
   Set it on the backend as `FIREBASE_SERVICE_ACCOUNT_JSON` (already
   consumed by `ecobus_backend-main/src/services/fcmService.js`).

> Without `google-services.json`, EAS Android builds will fail
> (`Cannot find google-services.json`). Without
> `GoogleService-Info.plist`, iOS push tokens will not be issued.

### iOS APNs key (required for iOS push)

In **Apple Developer → Certificates, Identifiers & Profiles → Keys**, create
an APNs key, download the `.p8`, then upload it to Firebase Console →
**Cloud Messaging → Apple app configuration**. After that, Firebase mints
APNs tokens for your iOS users automatically.

---

## 2. Google Maps API key

The current key `AIzaSyCG5E5SZLZYoEo3SQujz-oIlRk5WMGarQI` is committed and
**unrestricted**. Before launch:

1. Google Cloud Console → **APIs & Services → Credentials**.
2. Edit the key → **Application restrictions**:
   - Android: package + SHA-1 (one entry per app: `app.ecobus.parents`,
     `app.ecobus.driver`)
   - iOS: bundle id (one entry per app)
3. **API restrictions**: limit to *Maps SDK for Android*, *Maps SDK for iOS*,
   and (if you use directions) *Directions API*.
4. Get the SHA-1 with:

   ```bash
   eas credentials -p android        # then: View keystore → SHA-1
   ```

---

## 3. EAS — projectId & Expo account

Both `app.json` files contain placeholders you **must** replace before the
first EAS build:

```json
"extra": { "eas": { "projectId": "REPLACE_WITH_EAS_PROJECT_ID" } },
"owner": "REPLACE_WITH_EXPO_ACCOUNT"
```

Easiest way:

```bash
cd ecobus_parent-main
eas init           # creates the project, fills in projectId for you
eas build:configure
```

Repeat in `ecobus_driver-main`.

---

## 4. App Store / Play Store submission credentials

In `eas.json → submit.production` (driver app uses placeholders):

- iOS: replace `appleId`, `ascAppId`, `appleTeamId`.
- Android: place a Google Play service-account key at
  `./secrets/play-service-account.json` (gitignored). Generated in
  Google Cloud → IAM → Service accounts, then linked in Play Console
  → Setup → API access.

---

## 5. Verify everything

```bash
# inside each app folder
npx expo-doctor                 # config sanity check
eas build -p android --profile preview      # APK to test on a device
eas build -p ios     --profile preview      # ad-hoc / TestFlight build
```

A successful preview build that returns a non-null FCM token from your
backend's `/devices` table is the green light to ship `production`.
