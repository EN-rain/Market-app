# PocketTrade Implementation Status

This document reflects the current codebase, not the original project proposal.

## Verified Checks

Last checked locally:

```text
backend: npm test
backend: npm run build
admin: npm run build
mobile: flutter analyze
```

All checks passed.

## Implemented

- NestJS backend with Prisma/PostgreSQL.
- Email/password registration and login.
- Email OTP creation and verification.
- OTP-backed password reset.
- JWT access tokens and refresh-token rotation/revocation.
- User profile read/update and account deletion request.
- Listing creation with 1-5 image uploads.
- Cloudinary image storage with local development fallback.
- Public listing search/filter/sort.
- Seller listing ownership checks, removal, sold status, and republish.
- Favorites.
- Conversations and text messages.
- Socket.IO message delivery.
- Firebase push-token registration and message notifications.
- User blocking.
- Listing, user, and conversation reports.
- Admin login.
- Admin dashboard metrics.
- Admin listing approval/rejection/removal/restoration.
- Admin user suspension/restoration.
- Admin report resolve/dismiss flow.
- Search analytics and admin activity logs.
- React admin panel.
- Flutter Android app.
- Docker/Render-oriented backend deployment files.

## Partial Or UI-Limited

- The backend supports direct email-only OTP login through `/auth/request-otp` and `/auth/verify-otp`, but the current Flutter sign-in screen is password-first.
- Seeded buyer and seller demo users do not have passwords by default.
- Seller listing editing exists in the backend, but the Flutter "My listings" UI currently exposes only mark sold, remove, and republish actions.
- Admin listing update exists in the backend, but the React admin table currently exposes only price editing.
- User `profileImage` is accepted by the backend, but the Flutter profile UI does not include image upload/edit.
- Report review can resolve or dismiss reports. Direct one-click moderation actions from a report card are not currently implemented.
- Search analytics are based on logged text searches. Filter-only searches are not logged as search terms.

## Not Currently Implemented

- Image messaging or file attachments in chat.
- Voice or video calls.
- Online payments, escrow, delivery integration, seller fees, paid promotions.
- Ratings, identity verification, and automated image moderation.
- Multi-admin permission levels.
- iOS app.
- Google Play signing and store publication automation.

## Source Of Truth

- Backend routes and business logic: `backend/src`
- Database schema: `backend/prisma/schema.prisma`
- Mobile app behavior: `mobile/lib`
- Admin app behavior: `admin/src`
