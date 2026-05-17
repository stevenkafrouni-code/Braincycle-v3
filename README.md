# Braincycle — Setup & Deployment Guide

Your personal AI diary. Built on Next.js, deployed to Vercel, installed on your tablet and phone as a PWA.

---

## What You Need

1. **Anthropic API Key** — anthropic.com/api
2. **Google Cloud Project** — console.cloud.google.com
3. **Vercel Account** — vercel.com (free tier is fine)
4. **This codebase** — what you're reading now

---

## Step 1 — Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account → go to API Keys
3. Click **Create Key** → copy it somewhere safe
4. This powers Braincycle's brain — keep it private, never share it

---

## Step 2 — Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **New Project** → name it "Braincycle"
3. Go to **APIs & Services → Library** and enable:
   - Gmail API
   - Google Calendar API
   - Google Tasks API
   - Google Drive API
4. Go to **APIs & Services → OAuth consent screen**
   - User type: External
   - App name: Braincycle
   - Add your email as a test user
5. Go to **APIs & Services → Credentials**
   - Click **Create Credentials → OAuth 2.0 Client ID**
   - Application type: Web application
   - Name: Braincycle
   - Authorised redirect URI: `https://YOUR-DOMAIN.vercel.app/api/google/callback`
   - Copy your **Client ID** and **Client Secret**

---

## Step 3 — Deploy to Vercel

### Option A — Vercel Dashboard (easiest)

1. Go to [vercel.com](https://vercel.com) → New Project
2. Upload this folder or connect your GitHub repo
3. Go to **Settings → Environment Variables** and add:

```
ANTHROPIC_API_KEY        = sk-ant-...
GOOGLE_CLIENT_ID         = ...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET     = GOCSPX-...
GOOGLE_REDIRECT_URI      = https://your-app.vercel.app/api/google/callback
NEXT_PUBLIC_APP_URL      = https://your-app.vercel.app
NEXTAUTH_SECRET          = (run: openssl rand -base64 32)
```

4. Click **Deploy** — takes about 60 seconds

### Option B — Vercel CLI

```bash
npm install -g vercel
cd braincycle
npm install
vercel --prod
```

---

## Step 4 — First Run

1. Open your Braincycle URL
2. Click **Connect Google Account** — authorises Gmail, Calendar, Tasks and Drive
3. You'll be redirected back to Braincycle, now fully connected
4. Hit **Sync Today** to pull in your day

---

## Step 5 — Install on Your Tablet & Phone

### iPad / iPhone (Safari)
1. Open your Braincycle URL in Safari
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Name it "Braincycle" → Add
5. It opens full-screen, no browser chrome — your diary

### Android
1. Open your Braincycle URL in Chrome
2. Tap the three-dot menu
3. Tap **Install app** or **Add to Home Screen**

---

## Step 6 — Custom Domain (optional but recommended)

1. In Vercel → Settings → Domains
2. Add `braincycle.misspickle.com.au` (or similar)
3. Update your Google OAuth redirect URI to match

---

## Making Changes

Changes are fast:
1. Tell Claude what you want changed
2. Claude updates the relevant file
3. Push to GitHub or re-deploy via Vercel → live in 60 seconds

---

## Environment Variables Reference

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → Credentials |
| `GOOGLE_REDIRECT_URI` | Your Vercel URL + `/api/google/callback` |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL |
| `NEXTAUTH_SECRET` | Run: `openssl rand -base64 32` |

---

## Estimated Costs

| Service | Cost |
|---|---|
| Anthropic API | ~$50–100/month (personal use) |
| Vercel | Free (Hobby tier is sufficient) |
| Google APIs | Free (within generous quotas) |
| Domain | ~$15/year (if using custom domain) |

---

Built by Steven Kafrouni. Powered by Claude.
