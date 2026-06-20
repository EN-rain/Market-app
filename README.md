# PocketTrade

Used-phone marketplace with a Flutter Android app, NestJS API, and React admin panel.

## Structure

```text
backend/   NestJS API, Prisma schema, migrations, seed data, Jest tests
admin/     React and TypeScript admin panel
mobile/    Flutter Android client
scripts/   QA and API test scripts
docs/      Supporting notes and test output
```

## Stack

- NestJS, TypeScript, Prisma, PostgreSQL
- Email/password sign-in, email OTP verification/reset, JWT access and refresh tokens
- Cloudinary, Socket.IO, Firebase Cloud Messaging
- React, Vite, Tailwind CSS, Recharts
- Flutter, Dio, GoRouter, secure storage
- Jest and PowerShell API tests

## Requirements

- Node.js and npm
- PostgreSQL
- Flutter SDK and Android SDK
- Cloudinary account
- Mailjet account for production email OTP
- Firebase project for push notifications

## Backend setup

Copy `.env.example` to `backend/.env` and fill in the database, JWT, Cloudinary, admin, Mailjet, Firebase, and CORS values.

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run start:dev
```

Default API URL:

```text
http://localhost:3000
```

Swagger UI:

```text
http://localhost:3000/api-docs
```

The development seed creates one administrator, one buyer, 20 sellers, 20 listings, favorites, and sample conversations.

Development buyer email:

```text
buyer@pockettrade.local
```

Seeded buyer and seller users do not have passwords by default. Use the OTP endpoints for those demo accounts, or create/reset a password-backed account through the mobile auth flow.

In development, OTP responses include `devCode`. Production sends codes through Mailjet.

## Admin setup

```bash
cd admin
npm install
```

Create `admin/.env` with:

```text
VITE_API_URL=http://localhost:3000
```

Run:

```bash
npm run dev
```

## Mobile setup

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:3000
```

Use `10.0.2.2` from an Android emulator. For a physical device, use the computer's local network IP address.

Place the Firebase Android configuration file at:

```text
mobile/android/app/google-services.json
```

## Main API routes

```text
POST /auth/request-otp
POST /auth/verify-otp
POST /auth/register
POST /auth/login
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/refresh
POST /auth/logout

GET    /listings
GET    /listings/:id
POST   /listings
GET    /listings/mine
PATCH  /listings/:id
DELETE /listings/:id
POST   /listings/:id/mark-sold
POST   /listings/:id/republish
```

Other modules:

```text
/favorites
/conversations
/blocks
/reports
/push-tokens
/admin
```

## Tests and builds

```bash
cd backend
npm test
npm run build
```

```bash
cd admin
npm run build
npm run lint
```

```bash
cd mobile
flutter analyze
flutter build apk --debug
```

Windows QA script:

```powershell
.\RUN_QA.bat
```

Options:

```powershell
.\RUN_QA.bat -SkipApiE2E
.\RUN_QA.bat -SkipApk
.\RUN_QA.bat -BaseUrl http://localhost:3000
```

QA logs are written to `qa-results/`.

## Deployment

See [`DEPLOY.md`](DEPLOY.md). Do not commit environment files or service credentials.

For a code-based feature status, including partial and not-currently-implemented areas, see [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md).
