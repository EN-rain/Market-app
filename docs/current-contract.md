# PocketTrade API Contract

Base URL:

```text
http://localhost:3000
```

Authenticated routes require:

```text
Authorization: Bearer <access-token>
```

Swagger UI is available at `/api-docs`.

## Authentication

The backend supports two user authentication paths:

- Email/password accounts through registration and login.
- Email OTP verification through `request-otp` and `verify-otp`, which creates the account automatically if it does not already exist.

The Flutter app currently uses email/password for normal sign-in, OTP after registration, and OTP for password reset.

```text
POST /auth/register
Body: { "email": "user@example.com", "password": "minimum-8-chars" }
Returns: OTP metadata. Verify with /auth/verify-otp.
```

```text
POST /auth/login
Body: { "email": "user@example.com", "password": "minimum-8-chars" }
Returns: accessToken, refreshToken, user
```

```text
POST /auth/forgot-password
Body: { "email": "user@example.com" }
```

```text
POST /auth/reset-password
Body: { "email": "user@example.com", "code": "123456", "password": "minimum-8-chars" }
Returns: accessToken, refreshToken, user
```

```text
POST /auth/request-otp
Body: { "email": "user@example.com" }
```

```text
POST /auth/verify-otp
Body: { "email": "user@example.com", "code": "123456" }
Returns: accessToken, refreshToken, user, isNewUser
```

```text
POST /auth/refresh
Body: { "refreshToken": "..." }
```

```text
POST /auth/logout
Body: { "refreshToken": "..." }
```

Authentication uses email addresses only. SMS and phone-number login are not supported.

## Users

```text
GET   /users/me
PATCH /users/me
POST  /users/me/delete-request
```

`PATCH /users/me` accepts `displayName`, `location`, `profileImage`, and `notificationPreferences`.

Suspended users are rejected by the authentication strategy.

## Listings

Public routes:

```text
GET /listings
GET /listings/:id
```

Authenticated seller routes:

```text
POST   /listings
GET    /listings/mine
PATCH  /listings/:id
DELETE /listings/:id
POST   /listings/:id/mark-sold
POST   /listings/:id/republish
```

`POST /listings` uses multipart form data with `photos` and the listing fields.
`PATCH /listings/:id` updates listing text/price/status-related fields only; replacing listing photos is not currently exposed as a seller endpoint.

## Favorites

```text
GET    /favorites
POST   /favorites
DELETE /favorites/:listingId
```

## Conversations

```text
POST /conversations
GET  /conversations
GET  /conversations/:id/messages
POST /conversations/:id/messages
POST /conversations/:id/read
```

Socket.IO clients authenticate with an access token in `handshake.auth.token`. Users may only join rooms for conversations where they are the buyer or seller.

Client event:

```text
joinConversation
```

Server event:

```text
messageCreated
```

## Blocking and reports

```text
POST   /blocks/:userId
DELETE /blocks/:userId
POST   /reports
```

Conversation reports require the reporter to be a participant.

## Push tokens

```text
POST /push-tokens
Body: { "token": "...", "platform": "android", "deviceId": "optional" }
```

## Admin

Admin routes are under `/admin` and require an access token with the current database role set to `admin`.

Main modules:

```text
/admin/dashboard
/admin/listings
/admin/users
/admin/reports
/admin/analytics/search
/admin/activity
```

## Development data

The seed script creates:

- one administrator
- one buyer
- 20 sellers
- 20 active listings
- sample favorites
- sample buyer and seller conversations

Development buyer email:

```text
buyer@pockettrade.local
```

In development, OTP responses include `devCode`. Production sends OTP codes by email through Mailjet.
