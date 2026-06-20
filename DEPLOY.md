# PocketTrade Deployment

## Backend

Deploy `backend/` to a Node.js host with PostgreSQL access.

Build and start commands:

```bash
cd backend
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy
npm run seed
npm run start
```

Required environment values:

```env
DATABASE_URL=
JWT_SECRET=
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
CORS_ORIGINS=https://your-admin-domain.example
ADMIN_BOOTSTRAP_EMAIL=
ADMIN_BOOTSTRAP_PASSWORD=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Email delivery for OTP verification and password reset:

```env
MAILJET_API_KEY=
MAILJET_API_SECRET=
MAILJET_FROM_EMAIL=verified_sender@example.com
MAILJET_FROM_NAME=PocketTrade
```

Push notifications:

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Use `NODE_ENV=production` in production. The backend requires a real `JWT_SECRET` when production mode is enabled.

Health and API docs:

```text
GET /health
GET /api-docs
```

## Admin panel

Deploy `admin/` to Vercel or another static host.

```bash
cd admin
npm ci
npm run build
```

Build-time variable:

```env
VITE_API_URL=https://your-api-domain.example
```

The build output is written to `admin/dist/`.

## Android app

Build against the deployed API:

```bash
cd mobile
flutter pub get
flutter analyze
flutter build apk --release --dart-define=API_URL=https://your-api-domain.example
```

For Play Store release:

```bash
flutter build appbundle --release --dart-define=API_URL=https://your-api-domain.example
```

Configure Android signing before producing a release build.

## Deployment order

1. Create the PostgreSQL database.
2. Deploy the backend environment values.
3. Run Prisma migrations.
4. Seed the administrator and development data only when required.
5. Deploy the admin panel with the backend URL.
6. Build the Android app with the same backend URL.
7. Test registration, login, email OTP verification/reset, image upload, chat, moderation, and push notifications.

## Security notes

- Do not commit `.env` files or service credentials.
- Restrict `CORS_ORIGINS` to the deployed admin domain.
- Rotate any credential that appears in logs or Git history.
- Do not run development seed data in production unless it is intentional.
- Use HTTPS for the backend, admin panel, and OAuth or email-provider callbacks.
