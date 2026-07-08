# Gym Tracker

A personal strength-training tracker built around your Upper/Lower/Core split. No backend, no build step — it's a static site that stores your data in the browser (`localStorage`), so it works fully offline once loaded.

Live at: [github.com/amulyamallavarapu-cpu/Gym-Tracker](https://github.com/amulyamallavarapu-cpu/Gym-Tracker)

## What's inside

- **Today** — log sets (weight × reps) for each exercise in the day's workout, swap any exercise for an alternative (or type a custom one), and see a live completion ring.
- **Program** — view and edit your five-day split (Upper 1 / Lower 1 / Upper 2 / Lower 2 / Core), adjust target sets/reps, or swap exercises permanently.
- **Stats** — total sessions, this week's count, current streak, total volume, a volume-over-time chart, a per-exercise progress chart, and estimated 1-rep-max personal records.
- **History** — every past session, expandable, with a delete option.
- **Backup & sync** — tap the download icon in the header. You can always export/import a local JSON backup. Optionally connect a free Supabase project (see below) to sign in and sync your log across every device.

## Deploying it

This repo is already connected for continuous deployment — push or edit a file on GitHub and your host redeploys automatically. If you ever need to set that connection up again from scratch:

### Vercel / Netlify (import from Git)
1. Go to [vercel.com/new](https://vercel.com/new) or [app.netlify.com](https://app.netlify.com)
2. **Import Git Repository** → select this repo
3. Framework preset: **Other** (no build step needed) → **Deploy**

### GitHub Pages (alternative)
In the repo: **Settings → Pages → Deploy from branch → main → / (root)**.

## Syncing across devices (optional, via Supabase)

By default the app is local-only. To access your log from your phone, laptop, wherever — with the same login — hook up a free [Supabase](https://supabase.com) project:

1. **Create a project** at [supabase.com](https://supabase.com/dashboard) (free tier is plenty for this).
2. **Run the setup script**: open your project → **SQL Editor** → **New query** → paste the contents of `supabase-setup.sql` (included in this repo) → **Run**. This creates the table that stores your log and locks it down so only you can read or write your own row.
3. **Get your API keys**: in your project, go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
4. **Paste them into `config.js`** (edit the file directly on GitHub, or locally):
   ```js
   const SUPABASE_URL = "https://your-project-ref.supabase.co";
   const SUPABASE_ANON_KEY = "your-anon-key-here";
   ```
5. **Optional — skip email confirmation**: in Supabase, go to **Authentication → Providers → Email** and turn off "Confirm email" if you'd rather not click a verification link the first time. Otherwise, just check your inbox after signing up.
6. Commit the `config.js` change — your host redeploys automatically. Tap the download icon in the header → **Sign in** → create an account with any email + password. Do the same on your other device with the same email/password, and your log will sync.

The anon key is meant to be public in client-side code like this — the SQL script's row-level-security policies are what actually keep your data private to your account, not the secrecy of the key.

If you skip this setup entirely, the app just keeps working in local-only mode — nothing breaks.

## Notes

- Local data lives in your browser's `localStorage`, scoped to whichever domain you deploy to.
- To reset local data, clear your browser's site data for the deployed URL, or run `localStorage.removeItem('gymtracker_v1')` in the console.
- Add the site to your phone's home screen (Share → Add to Home Screen on iOS, or the install icon in Chrome on Android) for an app-like feel.
