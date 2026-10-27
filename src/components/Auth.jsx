import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { LogIn, UserPlus, Loader2 } from 'lucide-react'
import { translate } from '../utils/language'

export default function Auth({ recovery = false, onPasswordUpdated }) {
  const [mode, setMode] = useState(recovery ? 'reset' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [language] = useState(() => localStorage.getItem('tally-language') || 'en')

  const showMsg = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (mode === 'done' || mode === 'email-sent') return
    if (mode !== 'reset' && !email) { showMsg('error', translate('Please enter your email address.', language)); return }
    if (['signin', 'signup'].includes(mode) && !password) { showMsg('error', translate('Please enter email and password.', language)); return }
    if (mode === 'reset') {
      if (!password || !passwordConfirm) { showMsg('error', translate('Please enter and confirm your new password.', language)); return }
      if (password !== passwordConfirm) { showMsg('error', translate('Passwords do not match.', language)); return }
    }

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
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      setLoading(false)
      if (error) showMsg('error', translate(error.message, language))
      else {
        showMsg('success', translate('If an account exists for this email, a password reset link has been sent.', language))
        setMode('email-sent')
      }
    } else if (mode === 'reset') {
      const { error } = await supabase.auth.updateUser({ password })
      setLoading(false)
      if (error) showMsg('error', translate(error.message, language))
      else setMode('done')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) showMsg('error', translate(error.message, language))
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-[#121212] dark:text-zinc-100 flex flex-col justify-center items-center px-4 py-12 select-none">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🪷</span>
            <span className="text-xl font-bold">{translate('Dhamma Tracker', language)}</span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {translate(mode === 'reset' ? 'Set a new password' : mode === 'forgot' ? 'Reset your password' : mode === 'done' ? 'Your password has been changed' : mode === 'signin' ? 'Sign in to your Dhamma workspace' : 'Create an account to begin your practice', language)}
          </p>
        </div>

        <div className="bg-white dark:bg-[#181818] rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-md">
          {['signin', 'signup'].includes(mode) && (
            <div className="flex mb-5 bg-zinc-100 dark:bg-[#121212] rounded-md p-1 border border-zinc-200 dark:border-zinc-850">
              {['signin', 'signup'].map(m => (
                <button key={m} type="button" onClick={() => { setMode(m); setMessage(null) }} className="flex-1 py-1.5 rounded text-xs font-medium">
                  {translate(m === 'signin' ? 'Sign In' : 'Sign Up', language)}
                </button>
              ))}
            </div>
          )}

          {mode !== 'done' && mode !== 'email-sent' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode !== 'reset' && <div>
                <label className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mb-1.5 block">{translate('Email Address', language)}</label>
                <input className="sb-input py-2" type="email" placeholder={translate('you@example.com', language)} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>}
              {['signin', 'signup', 'reset'].includes(mode) && <div>
                <label className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mb-1.5 block">{translate(mode === 'reset' ? 'New Password' : 'Password', language)}</label>
                <input className="sb-input py-2" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
              </div>}
              {mode === 'reset' && <div>
                <label className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mb-1.5 block">{translate('Confirm New Password', language)}</label>
                <input className="sb-input py-2" type="password" placeholder="••••••••" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} autoComplete="new-password" />
              </div>}
              {message && <div className="text-xs py-2 px-3 rounded font-medium border text-center">{message.text}</div>}
              <button type="submit" disabled={loading} className="sb-btn-primary w-full justify-center py-2.5 mt-2 text-xs font-semibold disabled:opacity-50">
                {loading ? <Loader2 size={14} className="animate-spin" /> : mode === 'signin' ? <LogIn size={14} /> : <UserPlus size={14} />}
                <span>{translate(loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Update Password', language)}</span>
              </button>
            </form>
          )}
          {(mode === 'signin' || mode === 'signup') && <button type="button" onClick={() => { setMode('forgot'); setMessage(null) }} className="w-full mt-4 text-xs text-emerald-700 hover:underline dark:text-emerald-400">{translate('Forgot password?', language)}</button>}
          {(mode === 'forgot' || mode === 'email-sent') && <button type="button" onClick={() => { setMode('signin'); setMessage(null) }} className="w-full mt-4 text-xs text-emerald-700 hover:underline dark:text-emerald-400">{translate('Back to sign in', language)}</button>}
          {mode === 'done' && <div className="mt-4 text-center text-xs text-emerald-700 dark:text-emerald-400">{translate('Password updated successfully.', language)}<button type="button" onClick={onPasswordUpdated} className="block w-full mt-3 text-xs underline">{translate('Continue to your account', language)}</button></div>}
          {mode === 'email-sent' && message && <div className="text-xs py-2 px-3 rounded font-medium border text-center">{message.text}</div>}
        </div>
      </div>
    </div>
  )
}
