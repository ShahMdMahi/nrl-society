# 🚀 NRL Society - Complete Cloudflare Setup Guide

## A-to-Z Guide for Deploying Your Social Media App

---

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Cloudflare Account Setup](#2-cloudflare-account-setup)
3. [Install Required Tools](#3-install-required-tools)
4. [Create Cloudflare Resources](#4-create-cloudflare-resources)
5. [Environment Configuration](#5-environment-configuration)
6. [Database Migrations](#6-database-migrations)
7. [Build & Deploy](#7-build--deploy)
8. [Custom Domain Setup](#8-custom-domain-setup)
9. [R2 Public Access Setup](#9-r2-public-access-setup)
10. [Monitoring & Debugging](#10-monitoring--debugging)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

### What You Need

- Node.js 18+ installed
- pnpm package manager (`npm install -g pnpm`)
- A Cloudflare account (free tier works!)
- Git installed

### Cloudflare Free Tier Limits

| Service | Free Tier Limit |
|---------|----------------|
| Workers | 100,000 requests/day |
| D1 Database | 5GB storage, 5M rows read/day |
| KV Storage | 1GB storage, 100K reads/day |
| R2 Storage | 10GB storage, 10M reads/month |
| Pages | Unlimited requests |

---

## 2. Cloudflare Account Setup

### Step 1: Create Account

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign up with email or continue with Google/GitHub
3. Verify your email address

### Step 2: Get Your Account ID

1. In dashboard, click on **Workers & Pages** in sidebar
2. Your **Account ID** is shown on the right side
3. Save this ID - you'll need it later

**Your Account ID:** `010b79585a07803a496cd9a3bb6cb919`

---

## 3. Install Required Tools

### Install Wrangler CLI

```bash
# Install globally
npm install -g wrangler

# Or use npx (no install needed)
npx wrangler --version
```

### Login to Cloudflare

```bash
npx wrangler login
```

This opens your browser to authorize Wrangler.

### Verify Login

```bash
npx wrangler whoami
```

---

## 4. Create Cloudflare Resources

Navigate to your project directory first:

```bash
cd c:\Users\shahm\Desktop\2025\nrl-society
```

### 4.1 Create D1 Databases

#### Main Database (for user data, posts, etc.)

```bash
npx wrangler d1 create nrl-society-db
```

**Output:** Database ID = `a40ffbda-e921-4c16-8dc7-580f955dd5eb`

#### Tag Cache Database (for Next.js ISR caching)

```bash
npx wrangler d1 create nrl-society-tag-cache
```

**Output:** Database ID = `02e310d3-6b66-40b1-9ffa-c4bca6d80640`

### 4.2 Create KV Namespaces

#### Sessions KV (for user sessions/auth)

```bash
npx wrangler kv namespace create SESSIONS_KV
```

**Output:** Namespace ID = `14ddf3302de544fd8f6f1d55b9639a9d`

#### Cache KV (for general caching)

```bash
npx wrangler kv namespace create CACHE_KV
```

**Output:** Namespace ID = `679369a958ed4cce83c5cc06102b0e5c`

### 4.3 Create R2 Buckets

#### Media Bucket (for user uploads - images, videos)

```bash
npx wrangler r2 bucket create nrl-society-media
```

#### Cache Bucket (for Next.js incremental cache)

```bash
npx wrangler r2 bucket create nrl-society-cache
```

---

## 5. Environment Configuration

### 5.1 wrangler.json (already configured)

Your `wrangler.json` should look like this:

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "nrl-society",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-03-25",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "nrl-society-db",
      "database_id": "a40ffbda-e921-4c16-8dc7-580f955dd5eb"
    },
    {
      "binding": "NEXT_TAG_CACHE_D1",
      "database_name": "nrl-society-tag-cache",
      "database_id": "02e310d3-6b66-40b1-9ffa-c4bca6d80640"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "SESSIONS_KV",
      "id": "14ddf3302de544fd8f6f1d55b9639a9d"
    },
    {
      "binding": "CACHE_KV",
      "id": "679369a958ed4cce83c5cc06102b0e5c"
    }
  ],
  "r2_buckets": [
    {
      "binding": "MEDIA_BUCKET",
      "bucket_name": "nrl-society-media"
    },
    {
      "binding": "NEXT_INC_CACHE_R2_BUCKET",
      "bucket_name": "nrl-society-cache"
    }
  ],
  "vars": {
    "NODE_ENV": "production"
  }
}
```

### 5.2 TypeScript Types (worker-configuration.d.ts)

```typescript
interface AppEnv {
  DB: D1Database;
  SESSIONS_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  MEDIA_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  NEXT_TAG_CACHE_D1: D1Database;
  NEXT_INC_CACHE_R2_BUCKET: R2Bucket;
  NODE_ENV: string;
}
```

### 5.3 Environment Variables Reference

| Variable | Type | Purpose |
|----------|------|---------|
| `DB` | D1Database | Main SQLite database for all app data |
| `SESSIONS_KV` | KVNamespace | Store user session tokens |
| `CACHE_KV` | KVNamespace | General purpose caching |
| `MEDIA_BUCKET` | R2Bucket | User uploaded media files |
| `NEXT_TAG_CACHE_D1` | D1Database | Next.js ISR tag cache |
| `NEXT_INC_CACHE_R2_BUCKET` | R2Bucket | Next.js incremental cache |
| `NODE_ENV` | string | "production" or "development" |

---

## 6. Database Migrations

### 6.1 Create Migration File

The migration file is at `migrations/0001_initial_schema.sql`

### 6.2 Run Migration on Remote D1

```bash
npx wrangler d1 execute nrl-society-db --remote --file=./migrations/0001_initial_schema.sql
```

### 6.3 Verify Tables Created

```bash
npx wrangler d1 execute nrl-society-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### Database Schema

| Table | Purpose |
|-------|---------|
| `users` | User accounts and profiles |
| `sessions` | Authentication sessions |
| `posts` | User posts/status updates |
| `comments` | Comments on posts |
| `likes` | Post likes |
| `friendships` | Friend relationships |
| `conversations` | Chat conversations |
| `conversation_participants` | Users in conversations |
| `messages` | Chat messages |
| `notifications` | User notifications |

---

## 7. Build & Deploy

### 7.1 Build for Cloudflare

```bash
pnpm run build:worker
```

This runs `opennextjs-cloudflare build` which:

1. Builds the Next.js app
2. Bundles it for Cloudflare Workers
3. Creates `.open-next/worker.js`

### 7.2 Deploy to Cloudflare

**Option A: Direct Deploy (Linux/Mac recommended)**

```bash
pnpm run deploy
```

**Option B: Deploy via GitHub Actions (Recommended for Windows)**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm run build:worker

      - name: Deploy to Cloudflare
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

**Setup GitHub Secrets:**

1. Go to GitHub repo → Settings → Secrets → Actions
2. Add `CLOUDFLARE_API_TOKEN` (create at cloudflare.com/profile/api-tokens)
3. Add `CLOUDFLARE_ACCOUNT_ID` = `010b79585a07803a496cd9a3bb6cb919`

### 7.3 Post-Deploy URL

After deploying, your app will be available at:

```bash
https://nrl-society.<your-subdomain>.workers.dev
```

---

## 8. Custom Domain Setup

### 8.1 Add Domain to Cloudflare

1. Go to Cloudflare Dashboard
2. Click **Add Site**
3. Enter your domain (e.g., `nrl-society.com`)
4. Select Free plan
5. Update nameservers at your registrar

### 8.2 Connect Workers to Domain

1. Go to **Workers & Pages** → **nrl-society**
2. Click **Settings** → **Domains & Routes**
3. Click **Add** → **Custom Domain**
4. Enter your domain
5. Cloudflare automatically provisions SSL

---

## 9. R2 Public Access Setup

To serve uploaded media files publicly:

### 9.1 Enable Public Access

1. Go to **R2** in Cloudflare Dashboard
2. Click on `nrl-society-media` bucket
3. Go to **Settings** → **Public Access**
4. Click **Allow Access**
5. Choose a subdomain (e.g., `media.nrl-society.com`)

### 9.2 Configure CORS

In R2 bucket settings, add CORS rules:

```json
[
  {
    "AllowedOrigins": ["https://nrl-society.com", "https://*.workers.dev"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 10. Monitoring & Debugging

### 10.1 View Logs

**Real-time logs:**

```bash
npx wrangler tail
```

**In Cloudflare Dashboard:**

1. Go to **Workers & Pages** → **nrl-society**
2. Click **Logs** tab

### 10.2 Analytics

1. Go to **Workers & Pages** → **nrl-society**
2. Click **Analytics** tab
3. View requests, errors, CPU time

### 10.3 D1 Analytics

1. Go to **Workers & Pages** → **D1**
2. Select `nrl-society-db`
3. View query metrics

---

## 11. Troubleshooting

### Common Issues

#### Issue: "ENOENT: no such file or directory ... resvg.wasm"

**Cause:** Windows + Wrangler bug with WASM files
**Solution:** Use GitHub Actions to deploy from Linux

#### Issue: "Database not found"

**Solution:** Ensure `database_id` in wrangler.json matches the actual D1 database ID

#### Issue: "KV namespace not found"

**Solution:** Ensure `id` in wrangler.json matches the actual KV namespace ID

#### Issue: "R2 bucket not found"

**Solution:** Ensure `bucket_name` in wrangler.json matches exactly

#### Issue: "Session not working"

**Solution:** Check SESSIONS_KV binding and verify the KV namespace exists

### Verify Resources Exist

```bash
# List D1 databases
npx wrangler d1 list

# List KV namespaces
npx wrangler kv namespace list

# List R2 buckets
npx wrangler r2 bucket list
```

### Reset Database (Development Only!)

```bash
npx wrangler d1 execute nrl-society-db --remote --command="DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS posts; DROP TABLE IF EXISTS comments; DROP TABLE IF EXISTS likes; DROP TABLE IF EXISTS friendships; DROP TABLE IF EXISTS conversations; DROP TABLE IF EXISTS conversation_participants; DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS notifications;"

# Then re-run migration
npx wrangler d1 execute nrl-society-db --remote --file=./migrations/0001_initial_schema.sql
```

---

## 📊 Resource Summary

### Your Created Resources

| Resource | Name | ID/Details |
|----------|------|------------|
| Account | <shahmdmahi24@gmail.com> | `010b79585a07803a496cd9a3bb6cb919` |
| D1 Database | nrl-society-db | `a40ffbda-e921-4c16-8dc7-580f955dd5eb` |
| D1 Database | nrl-society-tag-cache | `02e310d3-6b66-40b1-9ffa-c4bca6d80640` |
| KV Namespace | SESSIONS_KV | `14ddf3302de544fd8f6f1d55b9639a9d` |
| KV Namespace | CACHE_KV | `679369a958ed4cce83c5cc06102b0e5c` |
| R2 Bucket | nrl-society-media | For user uploads |
| R2 Bucket | nrl-society-cache | For Next.js ISR cache |

### Bindings Reference

```typescript
// How to access in API routes
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET() {
  const { env } = await getCloudflareContext();
  
  // Access D1
  const db = env.DB;
  
  // Access KV
  const sessions = env.SESSIONS_KV;
  const cache = env.CACHE_KV;
  
  // Access R2
  const mediaBucket = env.MEDIA_BUCKET;
}
```

---

## ✅ Checklist

- [x] Cloudflare account created
- [x] Wrangler CLI installed and logged in
- [x] D1 database created (nrl-society-db)
- [x] D1 tag cache created (nrl-society-tag-cache)
- [x] KV namespace created (SESSIONS_KV)
- [x] KV namespace created (CACHE_KV)
- [x] R2 bucket created (nrl-society-media)
- [x] R2 bucket created (nrl-society-cache)
- [x] wrangler.json configured with all IDs
- [x] Database migration run
- [ ] Deploy to Cloudflare (use GitHub Actions on Windows)
- [ ] Custom domain setup (optional)
- [ ] R2 public access configured (optional)

---

## 🎉 Next Steps

1. **Deploy using GitHub Actions** to avoid Windows WASM issues
2. **Add a custom domain** for production use
3. **Enable R2 public access** for media serving
4. **Monitor your app** using Cloudflare Analytics

Your app is ready! 🚀
