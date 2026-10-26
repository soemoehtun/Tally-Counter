import { useEffect, useId, useRef } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { translate } from '../utils/language'

export default function TargetSaveDialog({ open, language = 'en', saving = false, error, onSave, onClose }) {
  const titleId = useId()
  const saveRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = event => {
      if (event.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    saveRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-zinc-950/50 p-4 backdrop-blur-[2px] md:hidden" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-2xl dark:border-zinc-700 dark:bg-[#1b1b1b]">
        <button type="button" onClick={onClose} aria-label={translate('Close', language)} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
          <X size={16} aria-hidden="true" />
        </button>
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={22} aria-hidden="true" />
        </span>
        <h2 id={titleId} className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">{translate('Target reached!', language)}</h2>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{translate('Save this practice to your records.', language)}</p>
        {error && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <button ref={saveRef} type="button" onClick={onSave} disabled={saving} className="sb-btn-primary mx-auto mt-5 w-full justify-center px-4 py-2.5 disabled:opacity-50">
          {translate(saving ? 'Saving…' : 'Save record', language)}
        </button>
      </section>
    </div>
  )
}
