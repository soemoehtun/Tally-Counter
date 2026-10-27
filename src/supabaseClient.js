import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Use your project's URL and publishable key (or the legacy anon key).
// You can find them in: Supabase Dashboard → Project Settings → API
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
const AUTH_REQUEST_TIMEOUT_MS = 15_000

const fetchWithAuthTimeout = async (input, init = {}) => {
  const requestUrl = typeof input === 'string' ? input : input?.url || ''
  if (!requestUrl.includes('/auth/v1/')) return fetch(input, init)

  const controller = new AbortController()
  const requestSignal = init.signal || input?.signal
  let timedOut = false
  const abortRequest = () => controller.abort()
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, AUTH_REQUEST_TIMEOUT_MS)

  if (requestSignal?.aborted) {
    controller.abort()
  } else {
    requestSignal?.addEventListener('abort', abortRequest, { once: true })
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (timedOut) {
      throw new Error('Request timed out. Check your connection or email settings, then try again.')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    requestSignal?.removeEventListener('abort', abortRequest)
  }
}

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn(
    '⚠️  Supabase credentials are missing. ' +
    'Create a .env file at the project root with:\n' +
    '  VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co\n' +
    '  VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>'
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: fetchWithAuthTimeout },
})
