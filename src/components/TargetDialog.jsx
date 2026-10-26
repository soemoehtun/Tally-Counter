import { useEffect, useId, useRef } from 'react'
import { Target, X } from 'lucide-react'
import { translate } from '../utils/language'

export default function TargetDialog({ open, title, description, language = 'en', onClose, children }) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = event => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    dialogRef.current?.querySelector('input, button')?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-zinc-950/45 p-4 backdrop-blur-[2px]"
      onTouchStart={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="my-auto flex h-auto max-h-[calc(100dvh_-_2rem)] w-full max-w-xl flex-col overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl outline-none dark:border-zinc-700 dark:bg-[#1b1b1b] sm:p-6"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-700">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Target size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
              <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={translate('Close', language)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
            <X size={16} />
          </button>
        </header>
        <div className="flex min-h-0 flex-col pt-4">{children}</div>
      </section>
    </div>
  )
}
