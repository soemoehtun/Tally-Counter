import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { LogIn, UserPlus, Loader2, ArrowLeft, HelpCircle, Mail, RotateCw } from 'lucide-react'
import { translate } from '../utils/language'

export default function Auth({ recovery = false, onPasswordUpdated, initialError = null }) {
  const [mode, setMode] = useState(recovery ? 'reset' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [otp, setOtp] = useState('')
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(() => (initialError ? { type: 'error', text: initialError } : null))
  const [unconfirmedEmail, setUnconfirmedEmail] = useState(false)
  const [isEmailRateLimited, setIsEmailRateLimited] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)
  const [showTroubleshoot, setShowTroubleshoot] = useState(true)
  const [language] = useState(() => localStorage.getItem('tally-language') || 'en')

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const showMsg = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 6000)
  }

  const showAuthError = (error) => {
    const errorText = error?.message || (typeof error === 'string' ? error : '') || ''
    const isEmailLimit = /rate.?limit|over_email_send_rate_limit/i.test(errorText)
    const isUnauthorizedRecipient = /email address not authorized|recipient.*not authorized/i.test(errorText)
    const isOtpExpired = /otp_expired|token has expired|token is invalid/i.test(errorText)
    const isUnconfirmed = /email not confirmed/i.test(errorText)

    if (isUnconfirmed) {
      setUnconfirmedEmail(true)
    }

    if (isEmailLimit) {
      setIsEmailRateLimited(true)
    }

    const text = isEmailLimit
      ? 'Supabase email limit reached. Wait before trying again, or configure custom SMTP in Supabase Authentication settings.'
      : isUnauthorizedRecipient
        ? 'Supabase default email can only send to authorized team addresses. Configure custom SMTP in Supabase Authentication settings to send to Gmail users.'
        : isOtpExpired
          ? 'Confirmation code or link has expired. Please request a new one.'
          : errorText
    showMsg('error', translate(text, language))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (mode === 'done' || mode === 'email-sent') return
    const cleanEmail = email.trim()

    if (mode !== 'reset' && mode !== 'done' && !cleanEmail) {
      showMsg('error', translate('Please enter your email address.', language))
      return
    }
    if (mode === 'signin' || mode === 'signup') {
      if (!password) {
        showMsg('error', translate('Please enter email and password.', language))
        return
      }
    }
    if (mode === 'reset') {
      if (!password || !passwordConfirm) {
        showMsg('error', translate('Please enter and confirm your new password.', language))
        return
      }
      if (password !== passwordConfirm) {
        showMsg('error', translate('Passwords do not match.', language))
        return
      }
    }
    if (mode === 'verify-signup' && !otp.trim()) {
      showMsg('error', translate('Please enter the confirmation code.', language))
      return
    }

    setLoading(true)
    setUnconfirmedEmail(false)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      setLoading(false)

      if (error) {
        showAuthError(error)
      } else if (data.session) {
        showMsg('success', translate('Account created successfully.', language))
      } else if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        // Crucial: Supabase returns identities: [] when the user already exists!
        // In that case Supabase does NOT send an email code.
        showMsg('error', translate('An account with this email already exists. Please sign in.', language))
        setMode('signin')
      } else {
        setMode('verify-signup')
        setResendCooldown(60)
        showMsg(
          'success',
          translate(
            'Confirmation code sent! Check your inbox and spam folder. If you received a link instead, you can also click the link in the email.',
            language
          )
        )
      }
    } else if (mode === 'verify-signup') {
      const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: otp.trim(),
        type: 'signup',
      })
      setLoading(false)
      if (error) {
        showAuthError(error)
      } else {
        showMsg('success', translate('Email confirmed. Signing you in…', language))
      }
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin,
      })
      setLoading(false)
      if (error) {
        showAuthError(error)
      } else {
        showMsg(
          'success',
          translate('If an account exists for this email, a password reset link has been sent.', language)
        )
        setMode('email-sent')
      }
    } else if (mode === 'reset') {
      const { error } = await supabase.auth.updateUser({ password })
      setLoading(false)
      if (error) {
        showAuthError(error)
      } else {
        setMode('done')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      setLoading(false)
      if (error) {
        showAuthError(error)
      }
    }
  }

  const resendSignupCode = async () => {
    const cleanEmail = email.trim()
    if (!cleanEmail || resending || resendCooldown > 0) return
    setResending(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: cleanEmail })
    setResending(false)
    if (error) {
      showAuthError(error)
    } else {
      setResendCooldown(60)
      showMsg(
        'success',
        translate('New confirmation code sent. Please check your inbox and spam folder.', language)
      )
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-[#121212] dark:text-zinc-100 flex flex-col justify-center items-center px-4 py-12 select-none">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🪷</span>
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {translate('Dhamma Tracker', language)}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {translate(
              mode === 'signin'
                ? 'Sign in to your Dhamma workspace'
                : mode === 'verify-signup'
                  ? 'Enter the code sent to your email'
                  : 'Create an account to begin your practice',
              language
            )}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white dark:bg-[#181818] rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-md">
          {/* Tabs */}
          {mode !== 'forgot' && mode !== 'reset' && mode !== 'done' && mode !== 'email-sent' && (
            <div className="flex mb-5 bg-zinc-100 dark:bg-[#121212] rounded-md p-1 border border-zinc-200 dark:border-zinc-850">
              {['signin', 'signup'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m)
                    setMessage(null)
                    setUnconfirmedEmail(false)
                  }}
                  className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                    (mode === m || (mode === 'verify-signup' && m === 'signup'))
                      ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700/60'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300'
                  }`}
                >
                  {translate(m === 'signin' ? 'Sign In' : 'Sign Up', language)}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode !== 'reset' && mode !== 'done' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 block">
                    {translate('Email Address', language)}
                  </label>
                  {mode === 'verify-signup' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup')
                        setMessage(null)
                      }}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {translate('Change email', language)}
                    </button>
                  )}
                </div>
                <input
                  className="sb-input py-2"
                  type="email"
                  placeholder={translate('you@example.com', language)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={mode === 'verify-signup'}
                />
              </div>
            )}

            {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
              <div>
                <label className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mb-1.5 block">
                  {translate(mode === 'reset' ? 'New Password' : 'Password', language)}
                </label>
                <input
                  className="sb-input py-2"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </div>
            )}

            {mode === 'reset' && (
              <div>
                <label className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mb-1.5 block">
                  {translate('Confirm New Password', language)}
                </label>
                <input
                  className="sb-input py-2"
                  type="password"
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            )}

            {mode === 'verify-signup' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 block">
                    {translate('Email confirmation code', language)}
                  </label>
                </div>
                <input
                  className="sb-input py-2 text-center font-mono tracking-widest text-base"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={10}
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  autoFocus
                />
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {translate('Enter the code from your email', language)}
                </p>
              </div>
            )}

            {message && (
              <div
                className={`text-xs py-2.5 px-3 rounded font-medium border text-center ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                    : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30'
                }`}
              >
                {message.text}
              </div>
            )}

            {isEmailRateLimited && (
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex flex-col gap-2">
                <div className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <span>⚡</span>
                  <span>{translate('Bypass email limit (Instant access):', language)}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {translate('Your account is already created! You can confirm it instantly in Supabase SQL Editor without waiting for an email:', language)}
                </p>
                <div className="flex items-center justify-between p-2 rounded bg-black/5 dark:bg-white/5 font-mono text-[11px] gap-2">
                  <code className="break-all select-all text-zinc-800 dark:text-zinc-200">
                    UPDATE auth.users SET email_confirmed_at = NOW();
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('UPDATE auth.users SET email_confirmed_at = NOW();')
                      setCopiedSql(true)
                      setTimeout(() => setCopiedSql(false), 2500)
                    }}
                    className="px-2 py-1 text-[10px] font-sans font-semibold rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 shrink-0"
                  >
                    {copiedSql ? translate('Copied', language) : translate('Copy SQL', language)}
                  </button>
                </div>
                <div className="flex gap-2 mt-1">
                  <a
                    href="https://supabase.com/dashboard/project/xbeyhluowcrdxtgxyfme/sql/new"
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-1.5 px-2 rounded bg-amber-600 text-white font-medium text-[11px] text-center hover:bg-amber-700 transition-colors"
                  >
                    {translate('Open SQL Editor', language)}
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin')
                      setMessage(null)
                      setIsEmailRateLimited(false)
                    }}
                    className="flex-1 py-1.5 px-2 rounded bg-emerald-600 text-white font-medium text-[11px] text-center hover:bg-emerald-700 transition-colors"
                  >
                    {translate('Sign In with Password', language)}
                  </button>
                </div>
              </div>
            )}

            {unconfirmedEmail && mode === 'signin' && (
              <button
                type="button"
                onClick={() => {
                  setMode('verify-signup')
                  setMessage(null)
                  setUnconfirmedEmail(false)
                }}
                className="w-full py-2 px-3 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-1.5"
              >
                <Mail size={13} />
                <span>{translate('Enter confirmation code or resend', language)}</span>
              </button>
            )}

            {mode !== 'done' && mode !== 'email-sent' && (
              <button
                type="submit"
                disabled={loading}
                className="sb-btn-primary w-full justify-center py-2.5 mt-1 text-xs font-semibold disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : mode === 'signin' ? (
                  <LogIn size={14} />
                ) : mode === 'verify-signup' ? (
                  <Mail size={14} />
                ) : (
                  <UserPlus size={14} />
                )}
                <span>
                  {translate(
                    loading
                      ? 'Please wait…'
                      : mode === 'signin'
                        ? 'Sign In'
                        : mode === 'signup'
                          ? 'Create Account'
                          : mode === 'forgot'
                            ? 'Send Reset Link'
                            : mode === 'verify-signup'
                              ? 'Confirm Email'
                              : 'Update Password',
                    language
                  )}
                </span>
              </button>
            )}
          </form>

          {/* Verification Actions */}
          {mode === 'verify-signup' && (
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={resendSignupCode}
                disabled={resending || !email || resendCooldown > 0}
                className="w-full text-xs text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 flex items-center justify-center gap-1 py-1"
              >
                <RotateCw size={12} className={resending ? 'animate-spin' : ''} />
                <span>
                  {resending
                    ? translate('Sending…', language)
                    : resendCooldown > 0
                      ? `${translate('Resend code in', language)} ${resendCooldown}s`
                      : translate('Resend confirmation code', language)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('signin')
                  setMessage(null)
                }}
                className="w-full text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center justify-center gap-1 py-1"
              >
                <ArrowLeft size={12} />
                <span>{translate('Back to sign in', language)}</span>
              </button>

              {/* Troubleshooting helper toggle */}
              <div className="mt-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                  className="w-full text-[11px] text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 flex items-center justify-center gap-1"
                >
                  <HelpCircle size={12} />
                  <span>{translate("Didn't receive the code?", language)}</span>
                </button>

                {showTroubleshoot && (
                  <div className="mt-2 p-3 rounded bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200/70 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 flex flex-col gap-2 leading-relaxed">
                    <p>• {translate('Check your spam or junk folder.', language)}</p>
                    <p>• {translate('Tip: Check your spam/junk folder. Or turn off "Confirm email" in Supabase Authentication settings to allow instant sign up.', language)}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin')
                        setMessage(null)
                      }}
                      className="w-full py-1.5 px-2 mt-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium text-xs hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors text-center"
                    >
                      {translate('Sign in with password instead', language)}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {(mode === 'signin' || mode === 'signup') && (
            <button
              type="button"
              onClick={() => {
                setMode('forgot')
                setMessage(null)
              }}
              className="w-full mt-4 text-xs text-emerald-700 hover:underline dark:text-emerald-400"
            >
              {translate('Forgot password?', language)}
            </button>
          )}

          {(mode === 'forgot' || mode === 'email-sent') && (
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setMessage(null)
              }}
              className="w-full mt-4 text-xs text-emerald-700 hover:underline dark:text-emerald-400"
            >
              {translate('Back to sign in', language)}
            </button>
          )}

          {mode === 'done' && (
            <div className="mt-4 text-center text-xs text-emerald-700 dark:text-emerald-400">
              {translate('Password updated successfully.', language)}
              <button
                type="button"
                onClick={onPasswordUpdated}
                className="block w-full mt-3 text-xs underline"
              >
                {translate('Continue to your account', language)}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
