# Schedgio — Setup Guide
Follow these steps in order. Each one should take about 5 minutes.

---

## Step 1 — Create a Supabase project (your database)

1. Go to https://supabase.com and click **Start your project**
2. Sign up with GitHub or email (free, no credit card)
3. Click **New project**
4. Fill in:
   - Name: `schedgio`
   - Database password: make something up and save it somewhere
   - Region: pick the one closest to you (e.g. US East)
5. Click **Create new project** — wait about 2 minutes for it to spin up
6. Once ready, go to **Project Settings → API**
7. Copy these two values — you'll need them soon:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### Run the database schema
1. In Supabase, go to **Database → SQL Editor**
2. Click **New query**
3. Open the file `supabase-schema.sql` from this project folder
4. Paste the entire contents into the editor
5. Click **Run** — you should see "Success"

### Enable Google login
1. In Supabase, go to **Authentication → Providers**
2. Click **Google**
3. Toggle it on
4. Follow the instructions to create a Google OAuth app (Supabase shows you exactly what to do)
5. Paste your Google Client ID and Secret back into Supabase
6. Save

---

## Step 2 — Get a Resend API key (for email notifications)

1. Go to https://resend.com and sign up (free, no credit card)
2. Click **API Keys → Create API Key**
3. Name it `schedgio`, click Create
4. Copy the key (starts with `re_...`) — you only see it once!

---

## Step 3 — Upload to GitHub

1. Go to https://github.com and create a free account if you don't have one
2. Click the **+** icon → **New repository**
3. Name it `schedgio`, set it to **Private**, click **Create**
4. GitHub will show you instructions — follow the ones under **"…or upload an existing file"**
5. Drag all the files from this folder into the browser upload

---

## Step 4 — Deploy to Vercel

1. Go to https://vercel.com and sign up with your GitHub account
2. Click **Add New → Project**
3. Find your `schedgio` repository and click **Import**
4. Before clicking Deploy, click **Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | NEXT_PUBLIC_SUPABASE_URL | your Supabase Project URL |
   | NEXT_PUBLIC_SUPABASE_ANON_KEY | your Supabase anon key |
   | RESEND_API_KEY | your Resend key (re_...) |
   | NEXT_PUBLIC_SITE_URL | https://schedgio.vercel.app |

5. Click **Deploy** — takes about 90 seconds
6. You'll get a live URL like `schedgio.vercel.app` 🎉

---

## Step 5 — Update your Supabase auth callback

Once deployed, tell Supabase your real URL:
1. Go to Supabase → **Authentication → URL Configuration**
2. Set **Site URL** to `https://schedgio.vercel.app`
3. Add `https://schedgio.vercel.app/**` to **Redirect URLs**
4. Save

---

## You're live!

Share `https://schedgio.vercel.app` with your first users.

Any time you change code, push to GitHub and Vercel auto-redeploys.
