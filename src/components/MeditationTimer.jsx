import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Play, Pause, RotateCcw, Save } from 'lucide-react'
import { playBellChime } from '../utils/sound'
import { translate } from '../utils/language'
import TargetDialog from './TargetDialog'
import TargetSaveDialog from './TargetSaveDialog'

export default function MeditationTimer({ userId, onSaved, language = 'en', soundEnabled = true, targetActionRef, targetMinutesValue = 30, onTargetChange }) {
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [targetMinutes, setTargetMinutes] = useState(targetMinutesValue)
  const [targetEditorOpen, setTargetEditorOpen] = useState(false)
  const [targetSaveOpen, setTargetSaveOpen] = useState(false)
  const [customTargetMinutes, setCustomTargetMinutes] = useState('')
  const [targetIsCustom, setTargetIsCustom] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [feedback, setFeedback] = useState(null)
  const ref = useRef(null)
  const completionPlayed = useRef(false)

  useEffect(() => setTargetMinutes(targetMinutesValue), [targetMinutesValue])

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setTotalSeconds(s => s + 1), 1000)
    } else {
      clearInterval(ref.current)
    }
    return () => clearInterval(ref.current)
  }, [running])

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const pct = Math.min((totalSeconds / (targetMinutes * 60)) * 100, 100)
  const circ = 2 * Math.PI * 168
  const customTargetValue = Number(customTargetMinutes)
  const canSetCustomTarget = Number.isInteger(customTargetValue) && customTargetValue >= 1 && customTargetValue <= 1440
  const targetReached = totalSeconds >= targetMinutes * 60

  useEffect(() => {
    if (totalSeconds < targetMinutes * 60) {
      completionPlayed.current = false
      return
    }
    if (running && !completionPlayed.current) {
      completionPlayed.current = true
      setRunning(false)
      setTargetSaveOpen(true)
      if (soundEnabled) playBellChime()
    }
  }, [totalSeconds, targetMinutes, running, soundEnabled])

  const showFeedback = (type, msg) => {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 3500)
  }

  const handleTogglePlay = useCallback(() => {
    if (!running && soundEnabled) {
      playBellChime() // Start bell
    }
    setRunning(r => !r)
  }, [running, soundEnabled])

  useEffect(() => {
    if (!targetActionRef) return
    targetActionRef.current = () => setTargetEditorOpen(open => !open)
    return () => {
      targetActionRef.current = null
    }
  }, [targetActionRef])

  const handleSetCustomTarget = () => {
    if (!canSetCustomTarget) return
    setTargetMinutes(customTargetValue)
    onTargetChange?.(customTargetValue)
    setTargetIsCustom(true)
    setTargetEditorOpen(false)
  }

  const handleReset = useCallback(() => {
    setRunning(false)
    setTotalSeconds(0)
  }, [])

  const handleSave = async () => {
    if (minutes === 0) {
      showFeedback('error', 'Please sit for at least 1 full minute to record.')
      return
    }
    setSaving(true)
    setRunning(false)
    const { error } = await supabase
      .from('meditation_records')
      .insert({ user_id: userId, duration_minutes: minutes })
    setSaving(false)
    if (error) {
      showFeedback('error', `${translate('Save failed', language)}: ${error.message}`)
    } else {
      if (soundEnabled) playBellChime()
      setTargetSaveOpen(false)
      showFeedback('success', `${minutes} ${translate('minutes of stillness recorded!', language)} Sādhu 🧘`)
      handleReset()
      onSaved?.()
    }
  }

  return (
    <div className="meditation-panel relative mx-auto flex min-h-[calc(100dvh_-_18rem)] w-full max-w-[960px] flex-col items-center justify-center gap-5 bg-transparent p-0 text-zinc-900 shadow-none dark:bg-transparent dark:text-zinc-100 md:min-h-[760px] md:justify-between md:gap-6 md:rounded-md md:border md:border-zinc-200 md:bg-white md:p-8 md:shadow-xs md:dark:border-zinc-800 md:dark:bg-[#181818] lg:p-9">
        {(running || totalSeconds > 0) && (
          <div className="absolute right-4 top-4 z-20 flex items-center gap-2 sm:right-8 sm:top-8">
            <div className={`text-xs font-mono font-medium px-2.5 py-1 rounded border ${
              running
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 animate-pulse'
                : 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
            }`}>
              {running ? `● ${translate('Meditating', language)}` : `⏸ ${translate('Paused', language)}`}
            </div>
          </div>
        )}

      {/* Circular Clock Face */}
      <div className="meditation-timer-face relative flex w-full flex-1 min-h-[260px] md:min-h-[360px] items-center justify-center my-1 md:my-2">
        <svg width="420" height="420" viewBox="0 0 420 420" className="absolute h-auto w-full max-w-[420px]">
          <circle cx="210" cy="210" r="168" fill="none" stroke="#e4e4e7" strokeWidth="8" className="dark:stroke-[#27272a]" />
          <circle
            cx="210" cy="210" r="168" fill="none" stroke="#496650" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct / 100)}
            transform="rotate(-90 210 210)"
            className="dark:stroke-[#9bbba1] transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>

        <button
          type="button"
          onClick={() => {
            if (targetReached) {
              setTargetSaveOpen(true)
            } else if (!running && totalSeconds === 0) {
              showFeedback('error', translate('Please click Start to begin meditation', language))
            } else {
              handleTogglePlay()
            }
          }}
          aria-label={translate(targetReached ? 'Save record' : running ? 'Pause' : 'Start Sit', language)}
          className="z-10 flex aspect-square w-[84%] max-w-[310px] cursor-pointer flex-col items-center justify-center rounded-full border-0 bg-transparent shadow-none transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-emerald-500 md:w-[78%] md:max-w-[280px]"
        >
          <span className="text-5xl sm:text-6xl font-normal text-[#304438] dark:text-zinc-100 tracking-wider font-serif">
            {String(minutes).padStart(2,'0')}:{String(seconds).padStart(2,'0')}
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-1 uppercase tracking-widest">
            {translate(targetReached ? 'Target reached' : running ? 'Tap to pause' : totalSeconds > 0 ? 'Tap to resume' : 'Click Start to begin', language)}
          </span>
        </button>
      </div>

      <TargetDialog
        open={targetEditorOpen}
        title={translate('Set meditation target', language)}
        description={translate('Choose how long you want to meditate.', language)}
        language={language}
        onClose={() => setTargetEditorOpen(false)}
      >
        <div className="flex flex-col gap-5">
          <div>
            <span className="mb-2 block text-xs font-medium text-zinc-700 dark:text-zinc-300">{translate('Target time', language)}</span>
            <div className="grid grid-cols-2 gap-2">
              {[15, 30, 45, 60].map(targetM => (
                <button
                  key={targetM}
                  type="button"
                  onClick={() => {
                    setTargetMinutes(targetM)
                    onTargetChange?.(targetM)
                    setTargetIsCustom(false)
                    setTargetEditorOpen(false)
                  }}
                  aria-pressed={!targetIsCustom && targetMinutes === targetM}
                  className={`rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
                    !targetIsCustom && targetMinutes === targetM
                      ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-amber-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                  }`}
                >
                  {targetM} {translate('minutes-short', language)}
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={event => { event.preventDefault(); handleSetCustomTarget() }} className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <label htmlFor="custom-meditation-target" className="mb-2 block text-xs font-medium text-zinc-700 dark:text-zinc-300">{translate('Custom target (minutes)', language)}</label>
            <div className="flex gap-2">
              <input
                id="custom-meditation-target"
                type="number"
                min="1"
                max="1440"
                step="1"
                inputMode="numeric"
                value={customTargetMinutes}
                onChange={event => setCustomTargetMinutes(event.target.value)}
                aria-label={translate('Custom meditation target in minutes', language)}
                placeholder="e.g. 20"
                className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <span className="self-center text-xs text-zinc-500 dark:text-zinc-400">{translate('minutes-short', language)}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <button type="button" onClick={() => setTargetEditorOpen(false)} className="sb-btn-secondary w-full justify-center px-4 py-2 sm:w-auto">{translate('Cancel', language)}</button>
              <button type="submit" disabled={!canSetCustomTarget} className="sb-btn-primary w-full justify-center px-4 py-2 disabled:opacity-40 sm:w-auto">{translate('Apply', language)}</button>
            </div>
          </form>
        </div>
      </TargetDialog>

      <TargetSaveDialog
        open={targetSaveOpen}
        language={language}
        saving={saving}
        error={feedback?.type === 'error' ? feedback.msg : null}
        onSave={handleSave}
        onClose={() => setTargetSaveOpen(false)}
      />



      {/* Action Buttons */}
      <div className="grid w-full grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={handleTogglePlay}
          className={`min-w-0 justify-center px-1 py-2 text-[10px] sm:px-3 sm:text-xs ${running ? 'sb-btn-secondary' : 'sb-btn-primary'}`}
        >
          {running ? <><Pause size={13}/><span>{translate('Pause', language)}</span></> : <><Play size={13}/><span>{translate('Start Sit', language)}</span></>}
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={totalSeconds === 0 && !running}
          className="sb-btn-danger min-w-0 justify-center px-1 py-2 text-[10px] sm:px-3 sm:text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw size={13}/><span>{translate('Reset', language)}</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || totalSeconds === 0}
          className="sb-btn-secondary min-w-0 justify-center px-1 py-2 text-[10px] font-medium text-amber-600 dark:text-amber-400 disabled:opacity-40 disabled:cursor-not-allowed sm:px-3 sm:text-xs"
        >
          <Save size={13}/><span>{translate(saving ? 'Saving…' : 'Save', language)}</span>
        </button>
      </div>

      {feedback && (
        <div className={`w-full text-center text-xs py-2 px-3 rounded font-medium border
          ${feedback.type === 'success'
            ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30'
            : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30'}`}>
          {feedback.msg}
        </div>
      )}

    </div>
  )
}
