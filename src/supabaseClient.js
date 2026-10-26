import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Use your project's URL and publishable key (or the legacy anon key).
// You can find them in: Supabase Dashboard → Project Settings → API
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn(
    '⚠️  Supabase credentials are missing. ' +
    'Create a .env file at the project root with:\n' +
    '  VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co\n' +
    '  VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>'
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
