import { useEffect, useState } from 'react'
import { Save, Volume2, VolumeX, SunMoon, Languages, LogOut, ChevronLeft, Target as TargetIcon, Clock } from 'lucide-react'
import { translate } from '../utils/language'

const sectionLabelClass = 'mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400'

export default function SettingsPage({ language = 'en', theme = 'light', beadTarget, meditationTarget, dailyMeditationGoal, soundEnabled, settingsReady = true, userEmail, settingsSyncError = '', onSave, onPreferenceChange, onResetAll, onSignOut, onCancel }) {
  const [beads, setBeads] = useState(String(beadTarget))
  const [dailyGoal, setDailyGoal] = useState(String(dailyMeditationGoal))
  const [sound, setSound] = useState(soundEnabled)
  const [themeChoice, setThemeChoice] = useState(theme)
  const [languageChoice, setLanguageChoice] = useState(language)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')

  useEffect(() => {
    setBeads(String(beadTarget))
    setDailyGoal(String(dailyMeditationGoal))
    setSound(soundEnabled)
    setThemeChoice(theme)
    setLanguageChoice(language)
  }, [beadTarget, dailyMeditationGoal, soundEnabled, theme, language])

  const beadValue = Number(beads)
  const minuteValue = Number(meditationTarget)
  const dailyGoalValue = Number(dailyGoal)
  const canSave = Number.isInteger(beadValue) && beadValue >= 1 && beadValue <= 100000
    && Number.isInteger(minuteValue) && minuteValue >= 1 && minuteValue <= 1440
    && Number.isInteger(dailyGoalValue) && dailyGoalValue >= 1 && dailyGoalValue <= 1440

  const save = async event => {
    event.preventDefault()
    if (!canSave || saving) return
    setSaving(true)
    setSaveError('')
    const error = await onSave({ beadTarget: beadValue, meditationTarget: minuteValue, dailyMeditationGoal: dailyGoalValue, soundEnabled: sound, theme: themeChoice, language: languageChoice })
    setSaving(false)
    if (error) {
      setSaveError(error)
      return
    }
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  const resetAll = async () => {
    if (resetting) return
    setResetting(true)
    setResetError('')
    const error = await onResetAll?.()
    setResetting(false)
    if (error) {
      setResetError(error)
      return
    }
    setResetConfirmOpen(false)
    setSaved(false)
  }

  const updatePreference = async (key, value) => {
    if (key === 'soundEnabled') setSound(value)
    if (key === 'theme') setThemeChoice(value)
    if (key === 'language') setLanguageChoice(value)
    const error = await onPreferenceChange?.({ [key]: value })
    setSaveError(error || '')
  }

  return (
    <section className="mx-auto w-full max-w-screen-md pb-4">
      <header className="mb-6">
        <div className="mb-5 flex items-center">
          <button type="button" onClick={onCancel} className="-ml-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium leading-none text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-2 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"><ChevronLeft size={16} aria-hidden="true" />{translate('Cancel', language)}</button>
        </div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">{translate('Preferences', language)}</p>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{translate('Settings', language)}</h1>
        <p className="mt-1 hidden text-xs leading-5 text-zinc-500 dark:text-zinc-400 sm:block">{translate('Manage your practice targets.', language)}</p>
      </header>

      <form onSubmit={save} className="space-y-6">
        <section>
          <h2 className={sectionLabelClass}>{translate('Practice goals', language)}</h2>
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1b1b1b]">
            <TargetControl icon={TargetIcon} language={language} id="settings-bead-target" label={translate('Daily bead practice target', language)} value={beads} unit={translate('beads', language)} min={1} max={100000} disabled={!settingsReady} onChange={setBeads} />
            <TargetControl icon={Clock} language={language} id="settings-daily-goal" label={translate('Daily meditation goal', language)} value={dailyGoal} unit={translate('minutes', language)} min={1} max={1440} disabled={!settingsReady} last onChange={setDailyGoal} />
          </div>
        </section>

        <section>
          <h2 className={sectionLabelClass}>{translate('Preferences', language)}</h2>
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1b1b1b]">
            <label htmlFor="settings-sound" className="flex cursor-pointer items-center justify-between gap-4 border-b border-zinc-100 px-4 py-3.5 dark:border-zinc-800">
              <span className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">{sound ? <Volume2 size={15} /> : <VolumeX size={15} />}</span><span><span className="block text-xs font-medium text-zinc-800 dark:text-zinc-200">{translate('Practice sounds', language)}</span><span className="mt-0.5 block text-[10px] text-zinc-500 dark:text-zinc-400">{translate('Control bead clicks and meditation bells.', language)}</span></span></span>
              <input id="settings-sound" type="checkbox" checked={sound} disabled={!settingsReady} onChange={event => updatePreference('soundEnabled', event.target.checked)} className="h-4 w-4 accent-emerald-700" />
            </label>
            <label htmlFor="settings-theme" className="flex items-center justify-between gap-4 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <span className="flex items-center gap-3"><SunMoon size={16} className="text-zinc-500" /><span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{translate('Appearance', language)}</span></span>
              <select id="settings-theme" value={themeChoice} disabled={!settingsReady} onChange={event => updatePreference('theme', event.target.value)} className="max-w-32 rounded-md bg-transparent px-2 py-1.5 text-right text-xs text-zinc-600 outline-none disabled:opacity-50 dark:text-zinc-300"><option value="light">{translate('Light', language)}</option><option value="dark">{translate('Dark', language)}</option></select>
            </label>
            <label htmlFor="settings-language" className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="flex items-center gap-3"><Languages size={16} className="text-zinc-500" /><span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{translate('Language', language)}</span></span>
              <select id="settings-language" value={languageChoice} disabled={!settingsReady} onChange={event => updatePreference('language', event.target.value)} className="max-w-32 rounded-md bg-transparent px-2 py-1.5 text-right text-xs text-zinc-600 outline-none disabled:opacity-50 dark:text-zinc-300"><option value="en">English</option><option value="my">မြန်မာ</option></select>
            </label>
          </div>
        </section>

        <section>
          <h2 className={sectionLabelClass}>{translate('Account', language)}</h2>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#1b1b1b]">
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{translate('Signed in as', language)}</p>
              <p className="mt-1 truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">{userEmail || '—'}</p>
            </div>
            <button type="button" onClick={onSignOut} className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"><LogOut size={14} /><span>{translate('Sign out', language)}</span></button>
          </div>
        </section>

        <div className="pt-1">
          <p role="status" aria-live="polite" className="mb-2 text-center text-xs text-emerald-700 dark:text-emerald-400">{saved ? translate('Settings saved.', language) : ''}</p>
          {(saveError || settingsSyncError) && <p role="alert" className="mb-2 text-center text-xs text-rose-600 dark:text-rose-400">{saveError || settingsSyncError}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" disabled={!settingsReady} onClick={() => { setResetError(''); setResetConfirmOpen(true) }} className="flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-3.5 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:bg-[#1b1b1b] dark:text-rose-300 dark:hover:bg-rose-950/30"><span>{translate('Reset all data', language)}</span></button>
            <button type="submit" disabled={!settingsReady || !canSave || saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#55785c] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#486b50] disabled:cursor-not-allowed disabled:opacity-40"><Save size={15} /><span>{saving ? translate('Saving…', language) : translate('Save Changes', language)}</span></button>
          </div>
        </div>
      </form>
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4" role="presentation">
          <section role="alertdialog" aria-modal="true" aria-labelledby="reset-data-title" aria-describedby="reset-data-description" className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-[#1b1b1b]">
            <h2 id="reset-data-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{translate('Reset all data', language)}?</h2>
            <p id="reset-data-description" className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{translate('This permanently deletes all your bead and meditation records, Adhithan goals and check-ins, recitation notes, and settings from this device and your account.', language)}</p>
            {resetError && <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">{resetError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={resetting} onClick={() => setResetConfirmOpen(false)} className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">{translate('Cancel', language)}</button>
              <button type="button" disabled={resetting} onClick={resetAll} className="rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50">{resetting ? translate('Resetting…', language) : translate('Delete all data', language)}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

function TargetControl({ id, label, value, unit, min, max, icon: Icon, language, disabled = false, last = false, onChange }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3.5 ${last ? '' : 'border-b border-zinc-100 dark:border-zinc-800'}`}>
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><Icon size={15} aria-hidden="true" /></span>
        <span className="min-w-0">
          <label htmlFor={id} className="block text-xs font-medium text-zinc-800 dark:text-zinc-200">{label}</label>
          <span className="mt-0.5 block text-[10px] text-zinc-500 dark:text-zinc-400">{translate('Maximum', language)}: {max.toLocaleString()} {unit}</span>
        </span>
      </span>
      <div className="grid w-28 shrink-0 grid-cols-[3rem_1fr] items-center gap-2">
        <input id={id} type="number" min={min} max={max} step="1" inputMode="numeric" required value={value} disabled={disabled} onChange={event => onChange(event.target.value)} aria-label={label} className="settings-number-input w-full border-0 bg-transparent p-0 text-center text-sm font-semibold tabular-nums text-zinc-800 outline-none focus:ring-0 disabled:opacity-50 dark:text-zinc-100" />
        <span className="whitespace-nowrap text-center text-[10px] text-zinc-500 dark:text-zinc-400">{unit}</span>
      </div>
    </div>
  )
}
