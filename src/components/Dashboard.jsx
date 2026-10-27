import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import BeadCounter, { BeadCountChart } from './BeadCounter'
import MeditationTimer from './MeditationTimer'
import AdhithanBoard from './AdhithanBoard'
import RecitationsPage from './RecitationsPage'
import CalendarView from './CalendarView'
import RecentPracticeActivity from './RecentPracticeActivity'
import SettingsPage from './SettingsPage'
import TargetDialog from './TargetDialog'
import SplitActionButton from './SplitActionButton'
import { translate } from '../utils/language'
import {
  BookOpenText, CalendarCheck, CalendarDays, CircleDot, Clock, LayoutDashboard, Loader2, Plus, Settings as SettingsIcon, Timer
} from 'lucide-react'

const practiceNavItems = [
  { id: 'dashboard', label: 'ပင်မစာမျက်နှာ', burmeseLabel: 'ပင်မစာမျက်နှာ', englishLabel: 'Dashboard', mobileLabel: 'ပင်မ', description: 'Daily summary & progress', icon: LayoutDashboard },
  { id: 'beads', label: 'ပုတီးစိပ်စက်', burmeseLabel: 'ပုတီးစိပ်စက်', englishLabel: 'Bead Counter', mobileLabel: 'ပုတီးစိပ်', description: 'Mala & tallies', icon: CircleDot },
  { id: 'meditate', label: 'တရားထိုင်ချိန်မှတ်စက်', burmeseLabel: 'တရားထိုင်ချိန်မှတ်စက်', englishLabel: 'Meditation Timer', mobileLabel: 'တရားထိုင်', description: 'Timer & breath', icon: Timer },
  { id: 'adhithan', label: 'အဓိဋ္ဌာန် မှတ်တမ်း', burmeseLabel: 'အဓိဋ္ဌာန် မှတ်တမ်း', englishLabel: 'Adhithan Tracker', mobileLabel: 'အဓိဋ္ဌာန်', description: 'Vows & intentions', icon: CalendarCheck },
  { id: 'recitations', label: 'နေ့စဉ် ဝတ်ရွတ်စဉ်', burmeseLabel: 'နေ့စဉ် ဝတ်ရွတ်စဉ်', englishLabel: 'Daily Recitations', mobileLabel: 'ဘုရားစာ', description: 'Daily recitations', icon: BookOpenText },
]

const mobileNavItems = [
  { id: 'dashboard', englishLabel: 'Dashboard', burmeseLabel: 'ပင်မစာမျက်နှာ', mobileLabel: 'ပင်မ', icon: LayoutDashboard },
  { id: 'recitations', englishLabel: 'Daily Recitations', burmeseLabel: 'နေ့စဉ် ဝတ်ရွတ်စဉ်', mobileLabel: 'ဘုရားစာ', icon: BookOpenText },
  { id: 'beads', englishLabel: 'Beads', burmeseLabel: 'ပုတီးစိပ်စက်', mobileLabel: 'ပုတီးစိပ်', icon: CircleDot },
  { id: 'meditate', englishLabel: 'Meditate', burmeseLabel: 'တရားထိုင်ချိန်မှတ်စက်', mobileLabel: 'တရားထိုင်', icon: Timer },
  { id: 'adhithan', englishLabel: 'Adhithan Tracker', burmeseLabel: 'အဓိဋ္ဌာန် မှတ်တမ်း', mobileLabel: 'အဓိဋ္ဌာန်', icon: CalendarCheck },
]

const DAILY_MEDITATION_GOAL = 15

export default function Dashboard({ userId, user, onSignOut }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [manualRecordOpen, setManualRecordOpen] = useState(false)
  const [manualRecordType, setManualRecordType] = useState('beads')
  const [manualRecordAmount, setManualRecordAmount] = useState('')
  const [manualRecordError, setManualRecordError] = useState('')
  const [manualRecordSaving, setManualRecordSaving] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('tally-theme') || 'light')
  const [language, setLanguage] = useState(() => localStorage.getItem('tally-language') || 'en')
  const [beadTarget, setBeadTarget] = useState(() => {
    const stored = Number(localStorage.getItem('tally-bead-target'))
    return Number.isInteger(stored) && stored >= 1 && stored <= 100000 ? stored : 108
  })
  const [meditationTarget, setMeditationTarget] = useState(() => {
    const stored = Number(localStorage.getItem('tally-meditation-target'))
    return Number.isInteger(stored) && stored >= 1 && stored <= 1440 ? stored : 30
  })
  const [dailyMeditationGoal, setDailyMeditationGoal] = useState(() => {
    const stored = Number(localStorage.getItem('tally-daily-meditation-goal'))
    return Number.isInteger(stored) && stored >= 1 && stored <= 1440 ? stored : DAILY_MEDITATION_GOAL
  })
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('tally-sound-enabled') !== 'false')
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [settingsSyncError, setSettingsSyncError] = useState('')
  const [summary, setSummary]     = useState({ beads: 0, mins: 0, goals: 0, done: 0, adhithanGoals: [], totalHistoricBeads: 0, totalHistoricMins: 0, activeDaysCount: 0 })
  const [allBeadsRecords, setAllBeadsRecords] = useState([])
  const [allMeditationRecords, setAllMeditationRecords] = useState([])
  const [allAdhithanRecords, setAllAdhithanRecords] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [headerNow, setHeaderNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setHeaderNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Sync theme with document element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('tally-theme', theme)
  }, [theme])

  useEffect(() => {
    let active = true
    const loadSettings = async () => {
      const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
      if (!active) return
      if (error) {
        setSettingsSyncError(error.message)
        setSettingsLoaded(true)
        return
      }

      const readNumber = (key, min, max, fallback) => {
        const value = Number(localStorage.getItem(key))
        return Number.isInteger(value) && value >= min && value <= max ? value : fallback
      }
      const values = data ? {
        beadTarget: data.bead_target,
        meditationTarget: data.meditation_target,
        dailyMeditationGoal: data.daily_meditation_goal,
        soundEnabled: data.sound_enabled,
        theme: data.theme,
        language: data.language,
      } : {
        beadTarget: readNumber('tally-bead-target', 1, 100000, 108),
        meditationTarget: readNumber('tally-meditation-target', 1, 1440, 30),
        dailyMeditationGoal: readNumber('tally-daily-meditation-goal', 1, 1440, DAILY_MEDITATION_GOAL),
        soundEnabled: localStorage.getItem('tally-sound-enabled') !== 'false',
        theme: localStorage.getItem('tally-theme') === 'dark' ? 'dark' : 'light',
        language: localStorage.getItem('tally-language') === 'my' ? 'my' : 'en',
      }

      setBeadTarget(values.beadTarget)
      setMeditationTarget(values.meditationTarget)
      setDailyMeditationGoal(values.dailyMeditationGoal)
      setSoundEnabled(values.soundEnabled)
      setTheme(values.theme)
      setLanguage(values.language)
      localStorage.setItem('tally-bead-target', String(values.beadTarget))
      localStorage.setItem('tally-meditation-target', String(values.meditationTarget))
      localStorage.setItem('tally-daily-meditation-goal', String(values.dailyMeditationGoal))
      localStorage.setItem('tally-sound-enabled', String(values.soundEnabled))
      localStorage.setItem('tally-theme', values.theme)
      localStorage.setItem('tally-language', values.language)

      if (!data) {
        const { error: insertError } = await supabase.from('user_settings').upsert({
          user_id: userId,
          bead_target: values.beadTarget,
          meditation_target: values.meditationTarget,
          daily_meditation_goal: values.dailyMeditationGoal,
          sound_enabled: values.soundEnabled,
          theme: values.theme,
          language: values.language,
        }, { onConflict: 'user_id' })
        if (!active) return
        if (insertError) setSettingsSyncError(insertError.message)
        else setSettingsSyncError('')
      } else {
        setSettingsSyncError('')
      }
      setSettingsLoaded(true)
    }
    loadSettings()
    return () => { active = false }
  }, [userId])

  // Fetch Supabase data (both today's cycle and all-time records for calendar & dashboard)
  const fetchData = useCallback(async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const iso = start.toISOString()

    const [bRToday, mRToday, gR, bRAll, mRAll, aRAll] = await Promise.all([
      supabase.from('beads_records').select('count').eq('user_id', userId).gte('created_at', iso),
      supabase.from('meditation_records').select('duration_minutes').eq('user_id', userId).gte('created_at', iso),
      supabase.from('adhithan_trackers').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('beads_records').select('id, count, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('meditation_records').select('id, duration_minutes, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('adhithan_checkins').select('id, goal_id, checkin_date').eq('user_id', userId).order('checkin_date', { ascending: false }),
    ])

    const beads = (bRToday.data || []).reduce((s, r) => s + r.count, 0)
    const mins  = (mRToday.data || []).reduce((s, r) => s + r.duration_minutes, 0)
    const goalsList = gR.data || []
    const done  = goalsList.filter(g => g.status === 'completed').length

    const allBeads = bRAll.data || []
    const allMins  = mRAll.data || []

    // Calculate unique active practice dates
    const uniqueDates = new Set()
    allBeads.forEach(r => { if (r.created_at) uniqueDates.add(r.created_at.split('T')[0]) })
    allMins.forEach(r => { if (r.created_at) uniqueDates.add(r.created_at.split('T')[0]) })

    setSummary({
      beads,
      mins,
      goals: goalsList.length,
      done,
      adhithanGoals: goalsList,
      totalHistoricBeads: allBeads.reduce((total, record) => total + (Number(record.count) || 0), 0),
      totalHistoricMins: allMins.reduce((s, r) => s + (Number(r.duration_minutes) || 0), 0),
      activeDaysCount: uniqueDates.size,
    })
    setAllBeadsRecords(allBeads)
    setAllMeditationRecords(allMins)
    setAllAdhithanRecords(aRAll.data || [])
  }, [userId])

  useEffect(() => { fetchData() }, [fetchData, refreshKey])
  const onSaved = () => setRefreshKey(k => k + 1)

  const openManualRecord = (type) => {
    setManualRecordType(type)
    setManualRecordAmount('')
    setManualRecordError('')
    setManualRecordOpen(true)
  }

  const saveManualRecord = async (event) => {
    event.preventDefault()
    const amount = Number(manualRecordAmount)
    const maxAmount = manualRecordType === 'beads' ? 1000000 : 1440
    if (!Number.isInteger(amount) || amount < 1 || amount > maxAmount) {
      setManualRecordError(translate(`Enter a whole number from 1 to ${maxAmount.toLocaleString()}.`, language))
      return
    }

    setManualRecordSaving(true)
    setManualRecordError('')
    const table = manualRecordType === 'beads' ? 'beads_records' : 'meditation_records'
    const payload = manualRecordType === 'beads'
      ? { user_id: userId, count: amount }
      : { user_id: userId, duration_minutes: amount }
    const { error } = await supabase.from(table).insert(payload)
    setManualRecordSaving(false)
    if (error) {
      setManualRecordError(`${translate('Save failed', language)}: ${error.message}`)
      return
    }

    setManualRecordOpen(false)
    setManualRecordAmount('')
    onSaved()
  }
  const persistSettingsRow = async overrides => {
    const { error } = await supabase.from('user_settings').upsert({
      user_id: userId,
      bead_target: overrides.beadTarget ?? beadTarget,
      meditation_target: overrides.meditationTarget ?? meditationTarget,
      daily_meditation_goal: overrides.dailyMeditationGoal ?? dailyMeditationGoal,
      sound_enabled: overrides.soundEnabled ?? soundEnabled,
      theme: overrides.theme ?? theme,
      language: overrides.language ?? language,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setSettingsSyncError(error?.message || '')
    return error?.message || null
  }
  const updateBeadTarget = value => {
    setBeadTarget(value)
    localStorage.setItem('tally-bead-target', String(value))
    persistSettingsRow({ beadTarget: value })
  }
  const updateMeditationTarget = value => {
    setMeditationTarget(value)
    localStorage.setItem('tally-meditation-target', String(value))
    persistSettingsRow({ meditationTarget: value })
  }
  const saveSettings = async settings => {
    setBeadTarget(settings.beadTarget)
    localStorage.setItem('tally-bead-target', String(settings.beadTarget))
    setMeditationTarget(settings.meditationTarget)
    localStorage.setItem('tally-meditation-target', String(settings.meditationTarget))
    setDailyMeditationGoal(settings.dailyMeditationGoal)
    setSoundEnabled(settings.soundEnabled)
    setTheme(settings.theme)
    setLanguage(settings.language)
    localStorage.setItem('tally-daily-meditation-goal', String(settings.dailyMeditationGoal))
    localStorage.setItem('tally-sound-enabled', String(settings.soundEnabled))
    localStorage.setItem('tally-language', settings.language)
    return await persistSettingsRow(settings)
  }
  const updatePreferences = preferences => {
    if (preferences.soundEnabled !== undefined) {
      setSoundEnabled(preferences.soundEnabled)
      localStorage.setItem('tally-sound-enabled', String(preferences.soundEnabled))
    }
    if (preferences.theme !== undefined) {
      setTheme(preferences.theme)
      localStorage.setItem('tally-theme', preferences.theme)
    }
    if (preferences.language !== undefined) {
      setLanguage(preferences.language)
      localStorage.setItem('tally-language', preferences.language)
    }
    return persistSettingsRow(preferences)
  }
  const resetAllData = async () => {
    const { error: checkinsError } = await supabase.from('adhithan_checkins').delete().eq('user_id', userId)
    const missingCheckinsTable = checkinsError && (checkinsError.code === 'PGRST205' || checkinsError.code === '42P01' || /adhithan_checkins.*schema cache/i.test(checkinsError.message || ''))
    if (checkinsError && !missingCheckinsTable) return checkinsError.message || 'Could not delete Adhithan check-ins.'

    for (const table of ['adhithan_trackers', 'beads_records', 'meditation_records', 'recitation_notes']) {
      const { error } = await supabase.from(table).delete().eq('user_id', userId)
      if (error) return error.message || `Could not delete ${table}.`
    }

    localStorage.removeItem(`adhithan-recitations:${userId}`)
    localStorage.removeItem(`adhithan-recitations-synced:${userId}`)
    const settingsError = await saveSettings({ beadTarget: 108, meditationTarget: 30, dailyMeditationGoal: 15, soundEnabled: true, theme: 'light', language: 'en' })
    if (settingsError) return settingsError
    setRefreshKey(key => key + 1)
    return null
  }
  // Recent combined practice activities for Dashboard feed
  const recentActivities = useMemo(() => {
    const list = []
    allBeadsRecords.slice(0, 10).forEach(r => {
      list.push({
        id: `bead-${r.created_at}-${r.count}`,
        type: 'beads',
        title: language === 'my' ? `ပုတီး ${Number(r.count).toLocaleString()} အကြိမ်ရေ` : `Mala ${Number(r.count).toLocaleString()} beads`,
        sub: `${Math.round((r.count / 108) * 10) / 10} ${translate('rounds completed', language)}`,
        created_at: r.created_at,
        time: r.created_at ? new Date(r.created_at).toLocaleTimeString(language === 'my' ? 'my-MM' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '',
        date: r.created_at ? new Date(r.created_at).toLocaleDateString(language === 'my' ? 'my-MM' : 'en-US', { month: 'short', day: 'numeric' }) : '',
      })
    })
    allMeditationRecords.slice(0, 10).forEach(r => {
      list.push({
        id: `med-${r.created_at}-${r.duration_minutes}`,
        type: 'meditation',
        title: language === 'my' ? `${r.duration_minutes} မိနစ် တရားထိုင်ခြင်း` : `${r.duration_minutes} Mins Meditation`,
        sub: translate('Anapanasati sitting practice', language),
        created_at: r.created_at,
        time: r.created_at ? new Date(r.created_at).toLocaleTimeString(language === 'my' ? 'my-MM' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '',
        date: r.created_at ? new Date(r.created_at).toLocaleDateString(language === 'my' ? 'my-MM' : 'en-US', { month: 'short', day: 'numeric' }) : '',
      })
    })
    list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    return list.slice(0, 6)
  }, [allBeadsRecords, allMeditationRecords, language])

  const meditationProgress = Math.min(summary.mins / dailyMeditationGoal, 1)
  const beadsProgress = Math.min(summary.beads / beadTarget, 1)
  const pageTitleKey = activeTab === 'dashboard'
    ? headerNow.getHours() < 12 ? 'Good morning' : headerNow.getHours() < 17 ? 'Good afternoon' : 'Good evening'
    : activeTab === 'beads' ? 'Bead Counter'
      : activeTab === 'meditate' ? 'Meditation'
        : activeTab === 'adhithan' ? 'Vows' : 'Recitations'
  const pageSubtitleKey = activeTab === 'beads' ? '108 mala bead ring with Tibetan singing bowl chime & sound presets.'
    : activeTab === 'meditate' ? 'Anapanasati stopwatch with custom intervals and authentic singing bowl bell.'
      : activeTab === 'adhithan' ? 'Your vows and intentions' : 'Daily prayers'
  const pageSubtitle = activeTab === 'dashboard'
    ? headerNow.toLocaleDateString(language === 'my' ? 'my-MM' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : translate(pageSubtitleKey, language)

  return (
    <div className={`reference-theme flex h-[100dvh] w-full max-w-full flex-col overflow-hidden overscroll-none bg-white font-sans text-zinc-900 dark:bg-[#121212] dark:text-zinc-100 ${activeTab === 'recitations' ? 'select-text' : 'select-none'}`}>

      <header className="fixed inset-x-0 top-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 pt-[env(safe-area-inset-top)] dark:border-zinc-800 dark:bg-[#171717] md:px-5">
        <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-2">
          <span className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{language === 'my' ? 'ဓမ္မမှတ်တမ်း' : 'Dhamma Tracker'}</span>
        </button>
        <button type="button" onClick={() => setActiveTab('settings')} aria-label={translate('Settings', language)} title={translate('Settings', language)} aria-current={activeTab === 'settings' ? 'page' : undefined} className={`grid h-9 w-9 shrink-0 place-items-center rounded-md transition-colors md:hidden ${activeTab === 'settings' ? 'bg-zinc-200 text-zinc-950 dark:bg-zinc-700 dark:text-white' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}>
          <SettingsIcon size={19} strokeWidth={1.8} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden pt-[calc(3.5rem+env(safe-area-inset-top))]">
        {/* Compact desktop page rail */}
        <aside className="hidden w-16 shrink-0 flex-col items-center gap-1.5 border-r border-zinc-200 bg-white py-4 dark:border-zinc-800 dark:bg-[#161616] md:flex">
          <nav className="flex flex-col items-center gap-1.5" aria-label={translate('Practice pages', language)}>
            {practiceNavItems.map(({ id, burmeseLabel, englishLabel, icon: Icon }) => {
              const isActive = activeTab === id
              const fullLabel = language === 'my' ? `${burmeseLabel} (${englishLabel})` : `${englishLabel} (${burmeseLabel})`
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={fullLabel}
                  title={fullLabel}
                  className={`group relative grid h-11 w-11 place-items-center rounded-lg transition-colors ${
                    isActive
                      ? 'bg-zinc-200 text-zinc-950 dark:bg-zinc-700 dark:text-white'
                      : 'text-zinc-950 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Icon size={21} strokeWidth={1.7} />
                  <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-zinc-100 dark:text-zinc-900">{fullLabel}</span>
                </button>
              )
            })}
          </nav>
          <button type="button" onClick={() => setActiveTab('settings')} aria-label={translate('Settings', language)} title={translate('Settings', language)} aria-current={activeTab === 'settings' ? 'page' : undefined} className={`group relative mt-auto grid h-11 w-11 place-items-center rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-zinc-200 text-zinc-950 dark:bg-zinc-700 dark:text-white' : 'text-zinc-950 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800'}`}>
            <SettingsIcon size={21} strokeWidth={1.7} />
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-zinc-100 dark:text-zinc-900">{translate('Settings', language)}</span>
          </button>
        </aside>

        <main className={`min-w-0 flex-1 overflow-y-auto bg-white p-4 pb-28 sm:p-6 sm:pb-28 md:pb-8 lg:p-8 lg:pb-8 ${activeTab === 'recitations' ? 'dark:bg-[#191919]' : 'dark:bg-[#121212]'}`}>
          {activeTab === 'dashboard' && (
            <div className="mx-auto mb-5 flex w-full max-w-screen-2xl flex-col items-start justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800 sm:flex-row sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{translate(pageTitleKey, language)}</h1>
                </div>
                <p className="mt-1.5 hidden text-sm text-zinc-500 dark:text-zinc-400 sm:block">{pageSubtitle}</p>
              </div>
            </div>
          )}
          {(activeTab === 'beads' || activeTab === 'meditate') && (
            <div className="mx-auto mb-4 flex w-full max-w-screen-2xl flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-zinc-300 pb-4 dark:border-zinc-700 sm:mb-5 sm:flex-nowrap">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{translate(pageTitleKey, language)}</h1>
                </div>
                <p className="mt-1.5 hidden text-sm text-zinc-500 dark:text-zinc-400 sm:block">{pageSubtitle}</p>
              </div>
              <SplitActionButton
                label={translate('Add record', language)}
                onClick={() => openManualRecord(activeTab)}
              />
            </div>
          )}
          {activeTab === 'dashboard' && (
            <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <button onClick={() => setActiveTab('beads')} className="group w-full rounded-md border border-zinc-200 bg-white p-4 text-left shadow-xs transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-[#181818] dark:hover:border-zinc-700">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium leading-snug text-zinc-500">{translate('ပုတီးစိတ်ခဲ့သော အကြိမ်အရေအတွက်', language)}</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">🧿</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold text-zinc-900 transition-colors group-hover:text-emerald-600 dark:text-zinc-100 dark:group-hover:text-emerald-400">{summary.beads.toLocaleString()}</span>
                    <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">/ {beadTarget.toLocaleString()} {translate('beads', language)}</span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.round(beadsProgress * 100)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-zinc-500">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{Math.round(beadsProgress * 100)}%</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{language === 'my' ? 'စုစုပေါင်း' : 'All Time Count'}</span>
                    <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300">{translate('ပုတီး', language)} {summary.totalHistoricBeads.toLocaleString()} {translate('အကြိမ်ရေ', language)}</span>
                  </div>
                </button>

                <button onClick={() => setActiveTab('meditate')} className="group w-full rounded-md border border-zinc-200 bg-white p-4 text-left shadow-xs transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-[#181818] dark:hover:border-zinc-700">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium leading-snug text-zinc-500">{translate('တရားထိုင်ခဲ့သည့်ကြာချိန်', language)}</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400">🧘</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold text-zinc-900 transition-colors group-hover:text-amber-600 dark:text-zinc-100 dark:group-hover:text-amber-400">{summary.mins}</span>
                    <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">/ {dailyMeditationGoal} {translate('minutes-short', language)}</span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${Math.round(meditationProgress * 100)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-zinc-500">
                    <span className="font-medium text-amber-600 dark:text-amber-400">{Math.round(meditationProgress * 100)}%</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{translate('All Time Count', language)}</span>
                    <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300">{language === 'my' ? `တရားထိုင် ${summary.totalHistoricMins.toLocaleString()} မိနစ်` : `Meditation ${summary.totalHistoricMins.toLocaleString()} minutes`}</span>
                  </div>
                </button>

                <button onClick={() => setActiveTab('adhithan')} className="group w-full rounded-md border border-zinc-200 bg-white p-4 text-left shadow-xs transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-[#181818] dark:hover:border-zinc-700">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium leading-snug text-zinc-500">{translate('အဓိဋ္ဌာန် မှတ်တမ်း', language)}</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CalendarDays size={14} /></span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">{summary.activeDaysCount}</span>
                    <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">{translate('တစ်သက်တာ လေ့ကျင့်ရက်', language)}</span>
                  </div>
                  <div className="mt-3 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{translate('အဓိဋ္ဌာန် ပန်းတိုင်များ', language)}</p>
                    {summary.adhithanGoals.length === 0 ? (
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{translate('ပန်းတိုင် မရှိသေးပါ', language)}</p>
                    ) : (
                      <ul className="flex max-h-24 flex-col gap-1 overflow-y-auto pr-1">
                        {summary.adhithanGoals.map(goal => (
                          <li key={goal.id} className="flex items-center justify-between gap-2 text-[10px]">
                            <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">{goal.title}</span>
                            <span className="shrink-0 font-mono font-medium text-zinc-500 dark:text-zinc-400">{goal.completed_days} / {goal.total_days} {translate('ရက်', language)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </button>

              </div>

              {/* History row keeps calendar, chart, and recent records in a 5:4:3 grid. */}
              <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-12">
                <div id="dashboard-calendar" className="order-1 min-w-0 scroll-mt-16 md:col-span-2 xl:col-span-4">
                  <CalendarView beadsRecords={allBeadsRecords} meditationRecords={allMeditationRecords} adhithanRecords={allAdhithanRecords} adhithanGoals={summary.adhithanGoals} compact wide showMeditationTime language={language} />
                </div>

                <div className="order-2 flex min-w-0 justify-center xl:col-span-5">
                  <BeadCountChart beadsRecords={allBeadsRecords} meditationRecords={allMeditationRecords} adhithanGoals={summary.adhithanGoals} language={language} />
                </div>

                <div className="order-3 hidden min-w-0 md:block xl:col-span-3">
                  <section className="h-full w-full rounded-md border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-[#181818]">
                    <div className="mb-3 flex items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                      <div>
                        <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{translate('Recent Activity', language)}</h2>
                        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{translate('Realtime sessions logged to PostgreSQL', language)}</p>
                      </div>
                    </div>
                    {recentActivities.length === 0 ? (
                      <div className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">{translate('No sessions recorded yet.', language)}</div>
                    ) : (
                      <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                        {recentActivities.map(act => (
                          <div key={act.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                            <div className="flex min-w-0 flex-1 items-center">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-zinc-800 dark:text-zinc-200">{act.title}</p>
                                <p className="truncate text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{act.sub}</p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">{act.date}</span>
                              <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">{act.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'beads' && (
            <div className="mx-auto w-full max-w-screen-2xl py-2">
              <BeadCounter userId={userId} onSaved={onSaved} beadsRecords={allBeadsRecords} meditationRecords={allMeditationRecords} language={language} soundEnabled={soundEnabled} targetBeadsValue={beadTarget} onTargetChange={updateBeadTarget} />
            </div>
          )}

          {activeTab === 'meditate' && (
            <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 items-start gap-5 py-2 xl:grid-cols-2">
              <MeditationTimer userId={userId} onSaved={onSaved} language={language} soundEnabled={soundEnabled} targetMinutesValue={meditationTarget} onTargetChange={updateMeditationTarget} />
                <div className="hidden w-full flex-col items-center gap-5 md:flex xl:items-start">
                <div className="grid w-full grid-cols-2 gap-3">
                  <div className="rounded-md border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-[#181818]">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><Clock size={14} className="text-amber-600 dark:text-amber-400" /><span className="text-[10px] font-semibold uppercase tracking-wide">{translate('တရားထိုင်ခဲ့သည့်ကြာချိန်', language)}</span></div>
                    <p className="mt-2 font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">{summary.totalHistoricMins.toLocaleString()}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{translate('Minutes · all time', language)}</p>
                  </div>
                  <div className="rounded-md border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-[#181818]">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><CalendarDays size={14} className="text-amber-600 dark:text-amber-400" /><span className="text-[10px] font-semibold uppercase tracking-wide">{translate('Meditation Sessions', language)}</span></div>
                    <p className="mt-2 font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">{allMeditationRecords.length.toLocaleString()}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{translate('Saved sessions', language)}</p>
                  </div>
                </div>
                <div className="flex w-full flex-col items-center gap-7 xl:items-start">
                  <CalendarView beadsRecords={[]} meditationRecords={allMeditationRecords} compact meditationOnly wide splitLayout language={language} />
                  <RecentPracticeActivity type="meditation" records={allMeditationRecords} wide language={language} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'adhithan' && (
            <div className="mx-auto w-full max-w-screen-2xl py-2">
              <AdhithanBoard userId={userId} onSaved={onSaved} language={language} />
            </div>
          )}

          {activeTab === 'recitations' && <RecitationsPage userId={userId} language={language} />}
          {activeTab === 'settings' && (
            <SettingsPage
              language={language}
              theme={theme}
              beadTarget={beadTarget}
              meditationTarget={meditationTarget}
              dailyMeditationGoal={dailyMeditationGoal}
              soundEnabled={soundEnabled}
              settingsReady={settingsLoaded}
              userEmail={user?.email}
              settingsSyncError={settingsSyncError}
              onSave={saveSettings}
              onPreferenceChange={updatePreferences}
              onResetAll={resetAllData}
              onSignOut={onSignOut}
              onCancel={() => setActiveTab('dashboard')}
            />
          )}

          <TargetDialog
            open={manualRecordOpen}
            title={translate(manualRecordType === 'beads' ? 'Add completed bead session' : 'Add completed meditation session', language)}
            description={translate('Record a practice you completed outside the live counter. It will be added to today’s records.', language)}
            language={language}
            onClose={() => setManualRecordOpen(false)}
          >
            <form onSubmit={saveManualRecord} className="flex flex-col gap-4">
              <div>
                <label htmlFor="manual-practice-amount" className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {translate(manualRecordType === 'beads' ? 'Beads completed' : 'Meditation minutes', language)}
                </label>
                <input
                  id="manual-practice-amount"
                  type="number"
                  min="1"
                  max={manualRecordType === 'beads' ? 1000000 : 1440}
                  step="1"
                  inputMode="numeric"
                  value={manualRecordAmount}
                  onChange={event => setManualRecordAmount(event.target.value)}
                  required
                  className="sb-input py-2.5"
                  placeholder={translate(manualRecordType === 'beads' ? 'e.g. 108' : 'e.g. 20', language)}
                />
              </div>
              {manualRecordError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{manualRecordError}</p>}
              <div className="grid grid-cols-2 gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <button type="button" onClick={() => setManualRecordOpen(false)} disabled={manualRecordSaving} className="sb-btn-secondary w-full justify-center px-4 py-2 disabled:opacity-50">{translate('Cancel', language)}</button>
                <button type="submit" disabled={manualRecordSaving} className="sb-btn-primary w-full justify-center px-4 py-2 disabled:opacity-50">
                  {manualRecordSaving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                  <span>{translate(manualRecordSaving ? 'Saving…' : 'Add record', language)}</span>
                </button>
              </div>
            </form>
          </TargetDialog>
        </main>
      </div>

      {/* Mobile page navigation */}
      <nav
        aria-label={translate('Page navigation', language)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-50 grid w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 grid-cols-5 gap-1 rounded-md border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-[#181818] md:hidden"
      >
        {mobileNavItems.map(({ id, burmeseLabel, englishLabel, mobileLabel, icon: Icon }) => {
          const isActive = activeTab === id
          const fullLabel = language === 'my' ? `${burmeseLabel} (${englishLabel})` : `${englishLabel} (${burmeseLabel})`
          const displayLabel = language === 'my' ? mobileLabel : ({ dashboard: 'Home', recitations: 'Recitations', adhithan: 'Adhithan' }[id] || englishLabel)
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={fullLabel}
              title={fullLabel}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded border px-1 py-2 text-[10px] font-medium transition-colors ${
                isActive
                  ? 'bg-zinc-200 text-zinc-950 border-zinc-300 shadow-xs dark:bg-zinc-700 dark:text-white dark:border-zinc-600'
                  : 'border-transparent text-zinc-950 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-white'
              }`}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span className="max-w-full truncate">{displayLabel}</span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}
