# Deployment

This app is deploy-ready for **Cloudflare Pages** as a static SPA build. Deployment to Cloudflare
was **not** performed as part of this build (no Cloudflare account is connected in this
environment) — the steps below are the exact remaining manual steps.

## What's already done

- `npm run build` produces a static `dist/` folder (`vite build`, verified to succeed with zero
  errors).
- `public/_redirects` is included so Cloudflare Pages serves `index.html` for any path (required
  for `react-router` client-side routing — otherwise refreshing `/app/projects/:id` would 404).
- `wrangler.toml` is present with `pages_build_output_dir = "dist"` in case you want to deploy
  via the `wrangler` CLI instead of the Cloudflare dashboard.
- `.env.example` documents the two env vars the build needs.

## Manual step 1 — Push this repo to GitHub (or GitLab)

Cloudflare Pages' easiest setup path connects to a git provider. This repo has a clean local git
history but no remote configured (per instructions, not pushed anywhere). You'll need to:

```bash
git remote add origin <your-repo-url>
git push -u origin main
```

## Manual step 2 — Create the Cloudflare Pages project

1. Log into the Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages**
   → **Connect to Git**.
2. Select this repository.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. **Environment variables** (Settings → Environment variables, for both Production and
   Preview): add
   - `VITE_SUPABASE_URL` = `https://xpxvreqnhrnwkrfdzymd.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (the anon/public key from `.env.local` / `.env.example`)

   These are safe to store as plain (non-secret) env vars in Cloudflare Pages since the anon key
   is meant to be public — RLS is what protects data (see `SECURITY.md`).
5. Click **Save and Deploy**.

## Manual step 3 (alternative) — Deploy via Wrangler CLI

If you'd rather not connect git, you can deploy the already-built `dist/` folder directly:

```bash
npm install -g wrangler   # or use npx wrangler
npm run build
npx wrangler pages deploy dist --project-name=miselium-operations
```

You'll be prompted to log into your Cloudflare account (`wrangler login`) the first time. This
path still requires setting the two `VITE_SUPABASE_*` environment variables in the Cloudflare
Pages project settings for subsequent builds if you later switch to git-based builds — or bake
them into a `.env.production` file before running `npm run build` locally, since env vars are
inlined at build time by Vite (`import.meta.env`), not read at runtime.

## Manual step 4 — Verify

Once deployed, visit the `*.pages.dev` URL Cloudflare gives you and confirm:

- `/login` loads and you can sign in with the demo credentials in `README.md`.
- Refreshing `/app/projects/:id` (or any deep route) does not 404 — confirms `_redirects` is
  working.
- Both an ADMIN and a DEVELOPER login show correctly scoped data.

## Custom domain (optional)

If Miselium wants this on a subdomain (e.g. `ops.miselium.com`), add it under the Pages
project's **Custom domains** tab after the first successful deploy — Cloudflare handles the DNS/
SSL automatically if the domain's DNS is already on Cloudflare.

## Rotating credentials before going further than a demo

The Supabase demo users' password (`Miselium2026!`) and the anon key currently in `.env.local`
were provisioned for this build. Before treating this as more than an internal demo, consider:

- Changing the demo users' passwords (or deleting them and having real team members sign up).
- Confirming Supabase Auth email confirmation / password policies match Miselium's actual
  security requirements (the demo users were created pre-confirmed for convenience).
