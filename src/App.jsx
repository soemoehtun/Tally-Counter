import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import { Loader2 } from 'lucide-react'
import { translate } from './utils/language'

const SESSION_INIT_TIMEOUT_MS = 18_000

const clearAuthCallbackFromUrl = () => {
  window.history.replaceState(window.history.state, '', window.location.pathname)
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [initialError, setInitialError] = useState(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    const searchParams = new URLSearchParams(window.location.search)
    const err = hashParams.get('error_description') || searchParams.get('error_description')
    return err ? decodeURIComponent(err.replace(/\+/g, ' ')) : null
  })
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    () => {
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const searchParams = new URLSearchParams(window.location.search)
      return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery'
    },
  )
  const language = localStorage.getItem('tally-language') || 'en'

  useEffect(() => {
    let mounted = true
    let sessionSettled = false
    const sessionTimeout = setTimeout(() => {
      if (!mounted || sessionSettled) return
      sessionSettled = true
      setSession(null)
      setInitialError(translate('Request timed out. Check your connection or email settings, then try again.', language))
    }, SESSION_INIT_TIMEOUT_MS)

    // Supabase consumes confirmation tokens from the URL while initializing
    // the session. Once finished, clean the credentials from the address bar.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return
      sessionSettled = true
      clearTimeout(sessionTimeout)
      setSession(session || null)
      setInitialError(error?.message || null)
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const searchParams = new URLSearchParams(window.location.search)
      const hasAuthResponse = ['access_token', 'refresh_token', 'error', 'error_description', 'type', 'code']
        .some((key) => hashParams.has(key) || searchParams.has(key))

      // Keep recovery credentials in the URL unless Supabase actually created
      // a session. A transient initialization error must remain retryable.
      if (!error && session && hasAuthResponse) clearAuthCallbackFromUrl()
    }).catch((error) => {
      if (!mounted) return
      sessionSettled = true
      clearTimeout(sessionTimeout)
      setSession(null)
      setInitialError(error?.message || 'Could not connect to Supabase. Check your connection and try again.')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      sessionSettled = true
      clearTimeout(sessionTimeout)
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
        setInitialError(null)
        clearAuthCallbackFromUrl()
      }
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false)
    })
    return () => {
      mounted = false
      clearTimeout(sessionTimeout)
      subscription.unsubscribe()
    }
  }, [language])

  if (isPasswordRecovery) {
    return (
      <Auth
        recovery
        recoveryPending={session === undefined}
        initialError={initialError}
        onPasswordUpdated={() => setIsPasswordRecovery(false)}
      />
    )
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#121212] flex items-center justify-center">
        <div className="text-center bg-white dark:bg-[#181818] p-8 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-800 flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-emerald-500/10 flex items-center justify-center text-xl text-emerald-600 dark:text-emerald-400">
            🪷
          </div>
          <Loader2 size={20} className="text-emerald-600 dark:text-emerald-400 animate-spin" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{translate('Connecting to Supabase…', language)}</p>
        </div>
      </div>
    )
  }

  if (!session) return <Auth initialError={initialError} />

  return (
    <Dashboard
      userId={session.user.id}
      user={session.user}
      onSignOut={() => supabase.auth.signOut()}
    />
  )
}
