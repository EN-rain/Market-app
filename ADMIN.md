# PocketTrade Admin

The admin panel is a React and TypeScript application under `admin/`. It uses the NestJS API under `/admin`.

## Setup

```bash
cd admin
npm install
```

Create `admin/.env`:

```env
VITE_API_URL=http://localhost:3000
```

Run locally:

```bash
npm run dev
```

Default local URL:

```text
http://localhost:5173
```

## Administrator account

The backend seed creates or updates the administrator using:

```env
ADMIN_BOOTSTRAP_EMAIL=
ADMIN_BOOTSTRAP_PASSWORD=
```

Run the seed after setting those values:

```bash
cd backend
npm run seed
```

Passwords are stored as bcrypt hashes. Do not place administrator credentials in documentation or source code.

## Modules

- Dashboard metrics and recent activity
- Listing approval, rejection, price editing, removal, and restoration
- User inspection, suspension, and restoration
- Report review and status updates
- Search analytics
- Administrative activity logs

The backend `PATCH /admin/listings/:id` route can update listing fields, but the current React UI only exposes price editing from the listing table. Full listing field/photo editing is not currently surfaced in the admin panel.

## API routes

```text
POST /admin/auth/login
GET  /admin/dashboard
GET  /admin/listings
GET  /admin/listings/:id
PATCH /admin/listings/:id
POST /admin/listings/:id/approve
POST /admin/listings/:id/reject
POST /admin/listings/:id/remove
POST /admin/listings/:id/restore
GET  /admin/users
GET  /admin/users/:id
GET  /admin/users/:id/listings
POST /admin/users/:id/suspend
POST /admin/users/:id/restore
GET  /admin/analytics/search
GET  /admin/reports
POST /admin/reports/:id/resolve
POST /admin/reports/:id/dismiss
GET  /admin/activity
```

## Build

```bash
npm run lint
npm run build
```

Static output is written to `admin/dist/`.

## Security

- Use a separate administrator password for each environment.
- Keep the JWT secret and admin password outside Git.
- Restrict backend CORS to the deployed admin origin.
- Suspend or rotate compromised administrator accounts and credentials.
- Review activity logs after moderation changes.
