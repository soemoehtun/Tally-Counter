# Dhamma Tracker

A React and Vite practice tracker backed by Supabase Auth and PostgreSQL.

## Run locally

1. Install Node.js and run `npm ci`.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Existing projects can keep using `VITE_SUPABASE_ANON_KEY` until they switch; the app supports both.
4. Run `npm run dev`.

`.env.local` is ignored by Git. Never commit it.

## Deploy from GitHub to Vercel

1. Create a **private** GitHub repository and push the project source.
2. In Vercel, choose **Add New → Project**, import that GitHub repository, and use the repository root as the project root.
3. Vercel detects Vite. Use `npm ci` for installation, `npm run build` for the build command, and `dist` for the output directory.
4. In the Vercel project’s **Settings → Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (or legacy `VITE_SUPABASE_ANON_KEY`)
5. Add these variables to **Production**. Use a separate Supabase project and its own values for **Preview/Development** deployments so test builds cannot access production user data.
6. Deploy, then add the production domain in Supabase **Authentication → URL Configuration** as the Site URL. Add the exact production URL to allowed redirect URLs. Add `http://localhost:5173/**` for local development. Only add preview URLs if those deployments should be able to authenticate.

Vite embeds `VITE_*` values into the browser bundle. The Supabase publishable key (and legacy anon key) is public by design, so database security must come from RLS. Never put a Supabase `service_role` or secret key in a `VITE_*` variable, browser code, GitHub, or Vercel frontend environment variables.

For a new Supabase project, run `database/schema.sql` and then `database/supabase_security_and_cloud_data_migration.sql` in the Supabase SQL Editor. The latter adds notes/settings tables and installs the app’s per-user RLS policies. The existing project has already had the migration applied. Do not run SQL files against production unless you intend to change that database.

## Files to commit

Commit the app source, the `database/` SQL files, `package.json`, `package-lock.json`, `.env.example`, `README.md`, `vercel.json`, and the Vite/Tailwind/PostCSS/ESLint configuration files.

Do not commit `.env`, `.env.local`, other `.env.*` files, `node_modules/`, `dist/`, `.vercel/`, or local `.codex/` files. `.env.example` is safe to commit because it contains placeholders only.
