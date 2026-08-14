# Database setup — Neon PostgreSQL

Pay3 uses **[Neon](https://neon.tech)** (serverless Postgres, free tier, works with Prisma). This matches `maincontext.md` §33.

## 1. Create a Neon project (2 minutes)

1. Go to [console.neon.tech](https://console.neon.tech/signup) and sign up (GitHub is fastest).
2. Create a project named **`pay3`** (region: pick closest to you, e.g. `AWS Asia Pacific Mumbai`).
3. On the project dashboard, click **Connect**.
4. Copy **both** connection strings:
   - **Pooled** — hostname contains `-pooler` → `DATABASE_URL`
   - **Direct** — same host **without** `-pooler` → `DIRECT_URL`

Example shape:

```env
# Pooled — app runtime (note -pooler in host)
DATABASE_URL="postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require"

# Direct — Prisma db push / migrations (no -pooler)
DIRECT_URL="postgresql://user:pass@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"
```

## 2. Add env vars

Paste into **`packages/database/.env`** and **`apps/api/.env`**:

```env
DATABASE_URL="your-pooled-url"
DIRECT_URL="your-direct-url"
```

`apps/api/.env` should also keep:

```env
PORT=4000
WEB_ORIGIN=http://localhost:3000
NODE_ENV=development
```

## 3. Push schema

```bash
npm run db:push
```

Creates all Pay3 tables on Neon.

## 4. Restart API

```bash
npm run dev:api
```

Overview should show **PostgreSQL (Neon)** after sign-in.

## Optional: Neon CLI

```bash
npx neonctl@latest auth
npx neonctl@latest projects create --name pay3
npx neonctl@latest connection-string --pooled   # DATABASE_URL
npx neonctl@latest connection-string            # DIRECT_URL
```

## Production notes

- Never commit real connection strings (`.env` is gitignored).
- Use Neon's **pooled** URL for the API in production.
- Use **direct** URL only for Prisma CLI (`db push`, `migrate`).
- Free tier scales to zero after idle — first request may be ~1s cold start.

## Fallback: local SQLite

Only for offline dev without Neon — change `provider` in `schema.prisma` to `sqlite` and remove `directUrl`. Not recommended once Neon is configured.
