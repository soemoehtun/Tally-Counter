import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { LogIn, UserPlus, Loader2 } from 'lucide-react'
import { translate } from '../utils/language'

export default function Auth() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [language] = useState(() => localStorage.getItem('tally-language') || 'en')

  const showMsg = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { showMsg('error', translate('Please enter email and password.', language)); return }
    setLoading(true)
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      setLoading(false)
      if (error) showMsg('error', translate(error.message, language))
      else showMsg('success', translate('Account created! Check your email to confirm, then sign in.', language))
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) showMsg('error', translate(error.message, language))
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-[#121212] dark:text-zinc-100 flex flex-col justify-center items-center px-4 py-12 select-none">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🪷</span>
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{translate('Dhamma Tracker', language)}</span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {translate(mode === 'signin' ? 'Sign in to your Dhamma workspace' : 'Create an account to begin your practice', language)}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white dark:bg-[#181818] rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-md">
          {/* Tabs */}
          <div className="flex mb-5 bg-zinc-100 dark:bg-[#121212] rounded-md p-1 border border-zinc-200 dark:border-zinc-850">
            {['signin', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                  mode === m
                    ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700/60'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300'
                }`}
              >
                {translate(m === 'signin' ? 'Sign In' : 'Sign Up', language)}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mb-1.5 block">{translate('Email Address', language)}</label>
              <input
                className="sb-input py-2"
                type="email"
                placeholder={translate('you@example.com', language)}
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mb-1.5 block">{translate('Password', language)}</label>
              <input
                className="sb-input py-2"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </div>

            {message && (
              <div className={`text-xs py-2 px-3 rounded font-medium border text-center ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                  : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30'
              }`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="sb-btn-primary w-full justify-center py-2.5 mt-2 text-xs font-semibold disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : mode === 'signin' ? (
                <LogIn size={14} />
              ) : (
                <UserPlus size={14} />
              )}
              <span>{translate(loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account', language)}</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
