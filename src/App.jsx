import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import { Loader2 } from 'lucide-react'
import { translate } from './utils/language'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery',
  )
  const language = localStorage.getItem('tally-language') || 'en'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const hasAuthResponse = ['access_token', 'refresh_token', 'error', 'error_description', 'type']
        .some((key) => hashParams.has(key))

      if (hasAuthResponse) {
        window.history.replaceState(
          window.history.state,
          '',
          window.location.pathname + window.location.search,
        )
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false)
    })
    return () => subscription.unsubscribe()
  }, [])

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

  if (isPasswordRecovery) {
    return <Auth recovery onPasswordUpdated={() => setIsPasswordRecovery(false)} />
  }

  if (!session) return <Auth />

  return (
    <Dashboard
      userId={session.user.id}
      user={session.user}
      onSignOut={() => supabase.auth.signOut()}
    />
  )
}
