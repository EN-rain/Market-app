# PocketTrade Mobile

Flutter Android client for PocketTrade.

## Stack

- Flutter and Dart
- Dio for HTTP requests
- GoRouter for navigation
- Flutter secure storage for access and refresh tokens
- Socket.IO client for chat updates
- Firebase Messaging for push tokens
- Image Picker for listing photos

## Requirements

- Flutter SDK
- Android SDK
- Running PocketTrade backend
- Firebase Android configuration for push notifications

## Configuration

The API URL is passed at build or run time:

```bash
flutter run --dart-define=API_URL=http://10.0.2.2:3000
```

Use `10.0.2.2` for an Android emulator. For a physical device, use the host computer's local network IP address.

Firebase configuration file:

```text
android/app/google-services.json
```

## Run

```bash
flutter pub get
flutter analyze
flutter run --dart-define=API_URL=http://10.0.2.2:3000
```

## Build

Debug APK:

```bash
flutter build apk --debug --dart-define=API_URL=http://10.0.2.2:3000
```

Release APK:

```bash
flutter build apk --release --dart-define=API_URL=https://your-api-domain.example
```

Release app bundle:

```bash
flutter build appbundle --release --dart-define=API_URL=https://your-api-domain.example
```

Configure Android signing before producing a release build.

## Authentication

The app uses email/password for normal sign-in. Registration sends an email OTP before completing the account session, and password reset also uses an email OTP code.

The backend also exposes direct email-only OTP login through `request-otp` and `verify-otp`, but the current Flutter sign-in screen is password-first.

```text
POST /auth/register
POST /auth/login
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/request-otp
POST /auth/verify-otp
POST /auth/logout
```

In development, the backend may return `devCode`. Production sends the code through email.

Seeded buyer and seller demo users do not have passwords unless one is set later. Use the OTP endpoints for those seeded accounts, or create/reset a password-backed account.

## Screens

- Login
- Home and listing feed
- Search and filters
- Listing details
- Create listing
- Favorites
- Conversations
- Chat
- Profile and seller listings

## API modules used

```text
/auth
/users
/brands
/listings
/favorites
/conversations
/blocks
/reports
/push-tokens
```

## Chat

The chat screen loads message history through REST and receives new messages through Socket.IO.

Socket authentication uses the current access token:

```text
handshake.auth.token
```

The client emits `joinConversation` with a conversation ID. The backend verifies that the authenticated user is the buyer or seller before joining the room.

## Checks

```bash
flutter analyze
flutter test
flutter build apk --debug
```

The `test/` and `integration_test/` directories are available for unit, widget, and integration tests.
