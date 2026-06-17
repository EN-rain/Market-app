# Deployment Guide — Used Phone Marketplace MVP

This guide walks through deploying the backend to **Render** and configuring the supporting services.

## Architecture

```
┌─────────────────────┐      ┌──────────────────┐
│  GitHub repo         │─────▶│  Render Web      │
│  (source of truth)   │      │  Service (Node)  │
└─────────────────────┘      └────────┬─────────┘
                                      │
                            ┌─────────┴──────────┐
                            ▼                    ▼
                  ┌──────────────────┐  ┌──────────────────┐
                  │  Neon Postgres    │  │  Cloudinary       │
                  │  (free tier)      │  │  (free tier)      │
                  └──────────────────┘  └──────────────────┘
```

## Prerequisites

1. **GitHub repo** with the code pushed (see `README.md`).
2. **Neon Postgres** free-tier database — connection string of the form:
   ```
   postgresql://<user>:<password>@<host>.neon.tech/neondb?sslmode=require
   ```
3. **Cloudinary** free-tier account — `cloud_name`, `api_key`, `api_secret`.
4. **Render** account — https://dashboard.render.com.

## Deploy backend to Render (one-click via Blueprint)

The repo includes `render.yaml` at the root — Render reads it and creates the service.

1. Open https://dashboard.render.com/blueprints.
2. Click **New Blueprint Instance**.
3. Connect the GitHub repo (`EN-rain/Market-app`).
4. Render reads `render.yaml` and shows the plan: 1 web service (`used-phone-marketplace-api`, free plan, Oregon).
5. Fill in the **secret values** in the form (Render will mark them as secret):
   - `DATABASE_URL`
   - `CLOUDINARY_URL`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `JWT_SECRET` (paste a 64-char random hex; or let Render generate)
   - `ADMIN_BOOTSTRAP_PASSWORD` (will be used by the seed to bootstrap an admin user)
   - `ADMIN_BOOTSTRAP_EMAIL`
6. Click **Apply**. Render clones the repo, runs `npm install && npx prisma generate && npm run build`, then starts the service which applies migrations + seeds the admin.

The service will be live at `https://used-phone-marketplace-api.onrender.com` after a few minutes.

## Verify the live deployment

```bash
# Health check
curl -s https://used-phone-marketplace-api.onrender.com/health | jq

# Should return:
# { "status": "ok", "db": "ok", "uptime": ..., "version": "0.0.1", "timestamp": "..." }

# Auth flow
curl -s -X POST https://used-phone-marketplace-api.onrender.com/auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"mobileNumber":"+14155552671"}'

# Brands
curl -s https://used-phone-marketplace-api.onrender.com/brands | jq '.[].name'
```

## Updating the deployed service

`render.yaml` has `autoDeploy: true`, so any push to the `main` branch triggers a new deploy automatically.

## Rotating secrets

```bash
# Update env vars via Render dashboard:
# https://dashboard.render.com/web/srv-XXXXX/env
```

Or via Render API:

```bash
curl -X PUT -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  https://api.render.com/v1/services/srv-XXXX/env-vars \
  -d '[{"key":"JWT_SECRET","value":"new-secret"}]'
```

## Admin bootstrap on first deploy

The `startCommand` in `render.yaml` runs:

```bash
cd backend && npx prisma migrate deploy && npm run seed && npm run start
```

`npm run seed` reads `ADMIN_BOOTSTRAP_PASSWORD` from env. If the env value is the placeholder `replace_with_random_password` (or shorter than 8 chars), the seed generates a random password and **prints it to the logs ONCE**. Set a known value before first deploy to control the password.

To retrieve the generated password:

```bash
# Render dashboard → Logs tab on the service
# Or via API:
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/srv-XXXX/logs?text=ADMIN"
```

## Logs

Real-time logs via dashboard, or:

```bash
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/srv-XXXX/logs"
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Build fails: `Cannot find module '@prisma/client'` | `prisma generate` skipped | Confirm `buildCommand` in render.yaml includes `npx prisma generate` |
| Deploy crashes: `JWT_SECRET must be set` | env not injected | Set in Render dashboard env vars |
| Deploy crashes: `P1001 Can't reach database server` | Neon DB unreachable | Check Neon dashboard; verify DATABASE_URL; free-tier Neons suspend after inactivity — wake it from the dashboard |
| `/health` returns `db:'error'` | Same as above | Same as above |
| Image upload fails | Cloudinary creds invalid | Re-check CLOUDINARY_* env vars |
| `npm run seed` overwrites admin password every deploy | `seed.ts` always upserts with the current env value | Expected; set ADMIN_BOOTSTRAP_PASSWORD to the desired value to freeze it |

## Cost

| Service | Tier | Cost |
|---------|------|------|
| Render Web Service | Free | $0 (spins down after 15 min idle) |
| Neon Postgres | Free | $0 (0.5 GB, scales to zero after 5 min idle) |
| Cloudinary | Free | $0 (25 credits/month, ~25k transforms) |
| **Total** | | **$0/month** |
