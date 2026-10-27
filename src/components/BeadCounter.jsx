import { lazy, Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import { supabase } from '../supabaseClient'
import {
  Play, Pause, Save, RotateCcw, Repeat2, Database
} from 'lucide-react'
import { playBeadClick, playBellChime } from '../utils/sound'
import CalendarView from './CalendarView'
import RecentPracticeActivity from './RecentPracticeActivity'
import TargetDialog from './TargetDialog'
import TargetSaveDialog from './TargetSaveDialog'
import { translate } from '../utils/language'

const BEAD_LIMIT = 108
const BarChart = lazy(() => import('@mui/x-charts/BarChart').then(module => ({ default: module.BarChart })))

function vibrate(pattern = [25]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern) } catch (_) {}
  }
}

function localDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function startOfWeek(date) {
  const weekStart = new Date(date)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  return weekStart
}

function getISOWeek(date) {
  const thursday = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  thursday.setUTCDate(thursday.getUTCDate() + 3 - ((thursday.getUTCDay() + 6) % 7))
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4))
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7))
  return 1 + Math.round((thursday - firstThursday) / 604800000)}

const shortWeekdays = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  my: ['နွေ', 'လာ', 'ဂါ', 'ဟူး', 'ကြာ', 'သော', 'နေ'],
}

const shortMonths = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  my: ['ဇန်', 'ဖေ', 'မတ်', 'ဧ', 'မေ', 'ဇွန်', 'ဇူ', 'ဩ', 'စက်', 'အောက်', 'နို', 'ဒီ'],
}

function formatChartWeekday(date, language) {
  return shortWeekdays[language === 'my' ? 'my' : 'en'][date.getDay()]
}

function formatChartMonth(date, language) {
  return shortMonths[language === 'my' ? 'my' : 'en'][date.getMonth()]
}



export function BeadCountChart({ beadsRecords, meditationRecords = [], adhithanGoals = [], currentBeads = 0, language = 'en' }) {
  const [period, setPeriod] = useState('day')
  const [selectedMetric, setSelectedMetric] = useState('value')
  const dateLocale = language === 'my' ? 'my-MM' : 'en-US'

  useEffect(() => {
    if (selectedMetric === 'adhithanGoals' && adhithanGoals.length === 0) setSelectedMetric('value')
  }, [selectedMetric, adhithanGoals.length])

  const chartData = useMemo(() => {
    const now = new Date()
    let buckets

    if (period === 'day') {
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      buckets = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today)
        date.setDate(today.getDate() - (6 - index))
        return {
          key: localDayKey(date),
          label: formatChartWeekday(date, language),
          detail: `${formatChartMonth(date, language)} ${date.toLocaleDateString(dateLocale, { day: 'numeric' })}`,
          value: 0,
          meditation: 0,
        }
      })
    } else if (period === 'week') {
      const currentWeekStart = startOfWeek(now)
      buckets = Array.from({ length: 7 }, (_, index) => {
        const start = new Date(currentWeekStart)
        start.setDate(currentWeekStart.getDate() - (6 - index) * 7)
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        const endDisplay = new Date(end)
        if (index === 6 && endDisplay > now) endDisplay.setTime(now.getTime())
        return {
          key: `${localDayKey(start)}_${localDayKey(end)}`,
          start,
          end,
          label: `W${String(getISOWeek(start)).padStart(2, '0')}`,
          detail: `${formatChartMonth(start, language)} ${start.toLocaleDateString(dateLocale, { day: 'numeric' })} - ${formatChartMonth(endDisplay, language)} ${endDisplay.toLocaleDateString(dateLocale, { day: 'numeric' })}`,
          value: 0,
          meditation: 0,
        }
      })
    } else {
      const firstMonth = new Date(now.getFullYear(), now.getMonth() - 6, 1)
      buckets = Array.from({ length: 7 }, (_, index) => {
        const start = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1)
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999)
        return {
          key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
          start,
          end,
          label: formatChartMonth(start, language),
          detail: start.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' }),
          value: 0,
          meditation: 0,
        }
      })
    }

    const bucketMap = new Map(buckets.map(b => [b.key, b]))

    beadsRecords.forEach(record => {
      if (!record.created_at) return
      const date = new Date(record.created_at)
      if (Number.isNaN(date.getTime())) return
      const value = Number(record.count) || 0
      if (period === 'day') {
        const bucket = bucketMap.get(localDayKey(date))
        if (bucket) bucket.value += value
      } else {
        const bucket = buckets.find(item => date >= item.start && date <= item.end)
        if (bucket) bucket.value += value
      }
    })

    meditationRecords.forEach(record => {
      if (!record.created_at) return
      const date = new Date(record.created_at)
      if (Number.isNaN(date.getTime())) return
      const minutes = Number(record.duration_minutes) || 0
      if (period === 'day') {
        const bucket = bucketMap.get(localDayKey(date))
        if (bucket) bucket.meditation += minutes
      } else {
        const bucket = buckets.find(item => date >= item.start && date <= item.end)
        if (bucket) bucket.meditation += minutes
      }
    })

    if (currentBeads > 0) {
      const todayKey = localDayKey(now)
      const currentBucket = period === 'day'
        ? bucketMap.get(todayKey)
        : buckets.find(item => now >= item.start && now <= item.end)
      if (currentBucket) {
        currentBucket.value += currentBeads
      }
    }

    return buckets
  }, [beadsRecords, meditationRecords, currentBeads, period, dateLocale])

  return (
    <section className="h-full w-full max-w-[640px] rounded-md border border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-[#181818]">
      <div className="flex items-center justify-between gap-3">
        <div>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            {translate('Activity Record', language)}
          </h3>
        </div>
        {selectedMetric !== 'adhithanGoals' && <div className="grid grid-cols-3 gap-0.5 rounded-md bg-zinc-100 p-1 dark:bg-zinc-900" role="group" aria-label={translate('Chart time range', language)}>
          {[
            { id: 'day', label: translate('Chart Day', language) },
            { id: 'week', label: translate('Chart Week', language) },
            { id: 'month', label: translate('Chart Month', language) },
          ].map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPeriod(option.id)}
              aria-pressed={period === option.id}
              className={`rounded px-2 py-1 text-[9px] font-medium transition-colors ${
                period === option.id
                  ? 'bg-white text-emerald-700 shadow-xs dark:bg-zinc-800 dark:text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>}
      </div>

      <div className="mt-5 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label={translate('Select chart metric', language)}>
        {[
          { id: 'value', label: translate('ပုတီးစိတ်ခဲ့သော အကြိမ်အရေအတွက်', language), color: '#10b981' },
          { id: 'meditation', label: translate('တရားထိုင်ခဲ့သည့်ကြာချိန်', language), color: '#f59e0b' },
          ...(adhithanGoals.length > 0 ? [{ id: 'adhithanGoals', label: translate('အဓိဋ္ဌာန် ပန်းတိုင်များ', language), color: '#8b5cf6' }] : []),
        ].map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSelectedMetric(option.id)}
            aria-pressed={selectedMetric === option.id}
            className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded border px-2 text-[10px] leading-none font-medium transition-colors ${
              selectedMetric === option.id
                ? 'border-zinc-300 bg-white text-zinc-800 shadow-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:bg-white/70 dark:text-zinc-400 dark:hover:bg-zinc-800/70'
            }`}
          >
            <span className={`block h-2 w-2 shrink-0 rounded-sm ${language === 'my' ? '' : 'translate-y-px'}`} style={{ backgroundColor: option.color }} aria-hidden="true" />
            <span className="whitespace-nowrap leading-none">{option.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-10 [--chart-text:#71717a] [--chart-axis:#d4d4d8] [--chart-grid:#e4e4e7] dark:[--chart-text:#d4d4d8] dark:[--chart-axis:#71717a] dark:[--chart-grid:#3f3f46]">
        {selectedMetric === 'adhithanGoals' ? (
          <div className="max-h-[340px] space-y-2 overflow-y-auto p-1">
            {adhithanGoals.map(goal => {
              const totalDays = Math.max(1, Number(goal.total_days) || 0)
              const completedDays = Math.max(0, Number(goal.completed_days) || 0)
              const percent = Math.min(Math.round((completedDays / totalDays) * 100), 100)
              const completed = goal.status === 'completed'
              const startedAt = goal.start_date ? new Date(`${goal.start_date}T12:00:00`) : null
              return (
                <div key={goal.id} className="rounded-md border border-zinc-200 bg-white px-3.5 py-3 shadow-xs dark:border-zinc-800 dark:bg-[#181818]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" />
                      <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100" title={goal.title}>{goal.title}</p>
                      {startedAt && !Number.isNaN(startedAt.getTime()) && <span className="shrink-0 whitespace-nowrap text-[9px] font-mono text-zinc-500 dark:text-zinc-400">{translate('Started', language)} {startedAt.toLocaleDateString(language === 'my' ? 'my-MM' : 'en-US')}</span>}
                    </div>
                  </div>
                  <div className="mt-2.5 mb-1.5 flex items-center justify-between gap-3 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                    <span>{translate('Day', language)} {completedDays} {translate('of', language)} {totalDays}</span>
                    <span className={completed ? 'font-semibold text-amber-600 dark:text-amber-400' : 'font-semibold text-emerald-600 dark:text-emerald-400'}>{percent}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className={`h-full rounded-full transition-all duration-500 ${completed ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <Box sx={{ width: '100%', height: 340 }}>
            <Suspense fallback={<div className="h-full w-full" aria-hidden="true" />}>
              <BarChart
                height={340}
                hideLegend
                xAxis={[{
                  data: chartData.map(item => item.label),
                  scaleType: 'band',
                  height: 28,
                  tickLabelStyle: { fill: 'var(--chart-text)', fontSize: language === 'my' ? 10 : 12 },
                }]}
                yAxis={[{ id: 'practiceAxisId', width: 44, tickLabelStyle: { fill: 'var(--chart-text)' } }]}
                series={[
                {
                  data: chartData.map(item => item[selectedMetric]),
                  label: translate(selectedMetric === 'value' ? 'ပုတီးစိတ်ခဲ့သော အကြိမ်အရေအတွက်' : 'တရားထိုင်ခဲ့သည့်ကြာချိန်', language),
                  id: `${selectedMetric}Id`,
                  yAxisId: 'practiceAxisId',
                  color: selectedMetric === 'value' ? '#10b981' : '#f59e0b',
                  valueFormatter: value => selectedMetric === 'value' ? `${translate('ပုတီး', language)} ${Number(value).toLocaleString()} ${translate('အကြိမ်ရေ', language)}` : `${Number(value).toLocaleString()} ${translate('minutes', language)}`,
                },
                ]}
                grid={{ horizontal: true }}
                margin={{ top: 8, right: 4, bottom: 8, left: 4 }}
                sx={{
                  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: 'var(--chart-axis)' },
                  '& .MuiChartsGrid-line': { stroke: 'var(--chart-grid)' },
                }}
              />
            </Suspense>
          </Box>
        )}
      </div>

    </section>
  )
}

export default function BeadCounter({ userId, onSaved, beadsRecords = [], meditationRecords = [], language = 'en', soundEnabled = true, targetActionRef, targetBeadsValue = BEAD_LIMIT, onTargetChange }) {
  const [count, setCount] = useState(0)
  const [rounds, setRounds] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [targetBeads, setTargetBeads] = useState(targetBeadsValue)
  const [targetDraft, setTargetDraft] = useState(String(targetBeadsValue))
  const [targetEditorOpen, setTargetEditorOpen] = useState(false)
  const [targetSaveOpen, setTargetSaveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [lastTappedTime, setLastTappedTime] = useState(null)
  const lastTouchCountedAt = useRef(0)
  const previousProgress = useRef({ total: 0, target: targetBeadsValue })

  useEffect(() => {
    setTargetBeads(targetBeadsValue)
    setTargetDraft(String(targetBeadsValue))
  }, [targetBeadsValue])

  const totalBeads = rounds * BEAD_LIMIT + count
  const targetProgress = Math.min(100, Math.round((totalBeads / targetBeads) * 100))
  const historicBeads = useMemo(
    () => beadsRecords.reduce((total, record) => total + (Number(record.count) || 0), 0),
    [beadsRecords]
  )
  const completedRounds = Math.floor((historicBeads + totalBeads) / BEAD_LIMIT)

  useEffect(() => {
    const previous = previousProgress.current
    if (previous.target === targetBeads && previous.total < targetBeads && totalBeads >= targetBeads) {
      setTargetSaveOpen(true)
      if (soundEnabled) playBellChime()
    }
    previousProgress.current = { total: totalBeads, target: targetBeads }
  }, [totalBeads, targetBeads, soundEnabled])

  const showFeedback = (type, msg) => {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 3500)
  }

  // Handle Tap (+1)
  const handleTap = useCallback(() => {
    if (!isActive) {
      showFeedback('error', translate('Please click Start to begin counting', language))
      return
    }
    if (totalBeads >= targetBeads) return
    setLastTappedTime(Date.now())
    setCount(prev => {
      const next = prev + 1
      if (next >= BEAD_LIMIT) {
        vibrate([60, 40, 80])
        if (soundEnabled) playBellChime()
        setRounds(r => r + 1)
        return 0
      }
      vibrate([15])
      if (soundEnabled) playBeadClick()
      return next
    })
  }, [isActive, language, soundEnabled, totalBeads, targetBeads])

  const handleToggleStart = () => {
    setIsActive(prev => {
      const next = !prev
      if (next) {
        vibrate([20])
        if (soundEnabled) playBeadClick()
      }
      return next
    })
  }

  const handlePageTouch = event => {
    if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select, [role="button"], [role="dialog"]')) return
    lastTouchCountedAt.current = Date.now()
    handleTap()
  }
  const handleCounterClick = useCallback(() => {
    // Touch devices fire a click after touchstart; that touch already counted.
    if (Date.now() - lastTouchCountedAt.current < 750) return
    handleTap()
  }, [handleTap])

  useEffect(() => {
    if (!targetActionRef) return
    targetActionRef.current = () => setTargetEditorOpen(open => !open)
    return () => {
      targetActionRef.current = null
    }
  }, [targetActionRef])

  const applyTarget = () => {
    const nextTarget = Number(targetDraft)
    if (!Number.isInteger(nextTarget) || nextTarget < 1 || nextTarget > 100000) return
    setTargetBeads(nextTarget)
    onTargetChange?.(nextTarget)
    setTargetEditorOpen(false)
  }

  // Handle Undo (-1)
  const handleUndo = useCallback(() => {
    setCount(prev => {
      if (prev === 0) {
        if (rounds === 0) return 0
        setRounds(r => r - 1)
        return BEAD_LIMIT - 1
      }
      return prev - 1
    })
  }, [rounds])

  // Handle Reset
  const handleReset = () => {
    setCount(0)
    setRounds(0)
    setIsActive(false)
  }

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault()
        handleTap()
      } else if (e.key === 'Backspace' || e.key === 'ArrowDown') {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleTap, handleUndo])

  // Save beads count to Supabase
  const handleSave = async () => {
    if (totalBeads === 0) {
      showFeedback('error', translate('No beads to save yet. Tap the mala ring to count beads.', language))
      return
    }
    setSaving(true)
    const { error } = await supabase.from('beads_records').insert({
      user_id: userId,
      count: totalBeads
    })
    setSaving(false)
    if (error) {
      showFeedback('error', `${translate('Save failed', language)}: ${error.message}`)
    } else {
      if (soundEnabled) playBellChime()
      setTargetSaveOpen(false)
      showFeedback('success', `${translate('Saved', language)} ${totalBeads} ${translate('beads', language)} (${rounds} ${translate('rounds', language)}) ${translate('to your account!', language)} Sādhu Sādhu Sādhu 🙏`)
      handleReset()
      onSaved?.()
    }
  }

  // Circular goal progress, styled to match the meditation timer.
  const SVG_SIZE = 420
  const CENTER = SVG_SIZE / 2
  const PROGRESS_RADIUS = 168
  const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS
  const strokeDashoffset = PROGRESS_CIRCUMFERENCE * (1 - targetProgress / 100)

  return (
    <div
      onTouchStart={handlePageTouch}
      onClick={event => {
        const target = event.target
        if (target instanceof Element && target.closest('button, a, input, textarea, select, [role="button"], [role="dialog"]')) return
        // Also support tap-like clicks from browsers that do not dispatch touchstart.
        if (Date.now() - lastTouchCountedAt.current < 750) return
        handleTap()
      }}
      className="max-w-screen-2xl mx-auto w-full grid grid-cols-1 xl:grid-cols-2 items-start gap-5 text-zinc-900 dark:text-zinc-100 select-none"
    >

      <TargetDialog
        open={targetEditorOpen}
        title={translate('Set bead target', language)}
        description={translate('Choose how many beads to complete this practice target.', language)}
        language={language}
        onClose={() => setTargetEditorOpen(false)}
      >
        <form onSubmit={event => { event.preventDefault(); applyTarget() }} className="flex flex-col gap-5">
          <div>
            <label htmlFor="bead-target" className="mb-2 block text-xs font-medium text-zinc-700 dark:text-zinc-300">{translate('Target beads', language)}</label>
            <div className="grid grid-cols-3 gap-2">
              {[108, 216, 500].map(value => (
                <button key={value} type="button" onClick={() => setTargetDraft(String(value))} aria-pressed={Number(targetDraft) === value} className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${Number(targetDraft) === value ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-zinc-200 bg-white text-zinc-600 hover:border-emerald-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}>
                  {value.toLocaleString()}
                </button>
              ))}
            </div>
            <input id="bead-target" type="number" min="1" max="100000" step="1" inputMode="numeric" value={targetDraft} onChange={event => setTargetDraft(event.target.value)} aria-label={translate('Target beads', language)} className="mt-3 w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">{translate('Enter a custom target from 1 to 100,000 beads.', language)}</p>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700 sm:flex sm:justify-end">
            <button type="button" onClick={() => setTargetEditorOpen(false)} className="sb-btn-secondary w-full justify-center px-4 py-2 sm:w-auto">{translate('Cancel', language)}</button>
            <button type="submit" disabled={!Number.isInteger(Number(targetDraft)) || Number(targetDraft) < 1 || Number(targetDraft) > 100000} className="sb-btn-primary w-full justify-center px-4 py-2 disabled:opacity-40 sm:w-auto">{translate('Apply', language)}</button>
          </div>
        </form>
      </TargetDialog>

      <TargetSaveDialog
        open={targetSaveOpen}
        language={language}
        saving={saving}
        error={feedback?.type === 'error' ? feedback.msg : null}
        onSave={handleSave}
        onClose={() => setTargetSaveOpen(false)}
      />



      {/* ── 1. MAIN BEAD COUNTER CARD ── */}
      <div className="bead-counter-panel relative mx-auto flex min-h-[calc(100dvh_-_18rem)] w-full max-w-[960px] flex-col items-center justify-center gap-5 bg-transparent p-0 text-zinc-900 shadow-none dark:bg-transparent dark:text-zinc-100 md:min-h-[760px] md:justify-between md:gap-6 md:rounded-md md:border md:border-zinc-200 md:bg-white md:p-8 md:shadow-xs md:dark:border-zinc-800 md:dark:bg-[#181818] lg:p-9">
        {(isActive || totalBeads > 0) && (
          <div className="absolute right-4 top-4 z-20 flex items-center gap-2 sm:right-8 sm:top-8">
            <div className={`text-xs font-mono font-medium px-2.5 py-1 rounded border ${
              isActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 animate-pulse'
                : 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
            }`}>
              {isActive ? `● ${translate('Counting', language)}` : `⏸ ${translate('Paused', language)}`}
            </div>
          </div>
        )}

        {/* ── 2. CIRCULAR BEAD GOAL PROGRESS ── */}
        <div className="bead-counter-progress relative flex w-full flex-1 min-h-[260px] md:min-h-[360px] items-center justify-center my-1 md:my-2">
          <svg
            width={SVG_SIZE}
            height={SVG_SIZE}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="absolute h-auto w-full max-w-[420px]"
          >
            <circle
              cx={CENTER}
              cy={CENTER}
              r={PROGRESS_RADIUS}
              fill="none"
              stroke="#e4e4e7"
              strokeWidth="8"
              className="dark:stroke-[#27272a]"
            />
            <circle
              cx={CENTER}
              cy={CENTER}
              r={PROGRESS_RADIUS}
              fill="none"
              stroke="#496650"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={PROGRESS_CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
              className="dark:stroke-[#9bbba1] transition-[stroke-dashoffset] duration-500 ease-out"
            />
          </svg>

          {/* Center Interactive Tap Surface */}
          <button
            type="button"
            onClick={handleCounterClick}
            title={translate(isActive ? 'Click or press Spacebar to count' : 'Click Start to begin', language)}
            aria-label={translate(isActive ? 'Click or press Spacebar to count' : 'Click Start to begin', language)}
            className="z-10 flex aspect-square w-[84%] max-w-[310px] cursor-pointer flex-col items-center justify-center rounded-full border-0 bg-transparent shadow-none transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-emerald-500 md:w-[78%] md:max-w-[280px]"
          >
            <span
              className="text-5xl sm:text-6xl font-normal text-[#304438] dark:text-zinc-100 tracking-wider font-serif"
            >
              {totalBeads.toLocaleString()}
            </span>

            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-1 uppercase tracking-widest">
              {!isActive && totalBeads === 0
                ? translate('Click Start to count', language)
                : !isActive
                  ? translate('Paused', language)
                  : `${translate('Target', language)} ${targetBeads.toLocaleString()} · ${targetProgress}%`}
            </span>
          </button>
        </div>

        {/* ── 4. ACTION BUTTONS ── */}
        <div className="grid w-full grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={handleToggleStart}
            className={`min-w-0 justify-center px-1 py-2 text-[10px] sm:px-3 sm:text-xs ${isActive ? 'sb-btn-secondary' : 'sb-btn-primary'}`}
          >
            {isActive ? (
              <>
                <Pause size={13} />
                <span>{translate('Pause', language)}</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>{translate(totalBeads > 0 ? 'Resume' : 'Start Beads', language)}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={totalBeads === 0}
            className="sb-btn-danger min-w-0 justify-center px-1 py-2 text-[10px] sm:px-3 sm:text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={13} />
            <span>{translate('Reset', language)}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || totalBeads === 0}
            className="sb-btn-secondary min-w-0 justify-center px-1 py-2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed sm:px-3 sm:text-xs"
          >
            <Save size={13} />
            <span>{translate(saving ? 'Saving…' : 'Save', language)}</span>
          </button>
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div className={`w-full text-center text-xs py-2 px-3 rounded font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30'
          }`}>
            {feedback.msg}
          </div>
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-5 xl:items-start">
        <div className="hidden w-full grid-cols-2 gap-3 md:grid">
          <div className="rounded-md border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-[#181818]">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Repeat2 size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">{translate('Rounds Completed', language)}</span>
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {completedRounds.toLocaleString()}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{translate('All time', language)}</p>
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-[#181818]">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Database size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">{translate('All Time Count', language)}</span>
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {(historicBeads + totalBeads).toLocaleString()}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{translate('Saved + current session', language)}</p>
          </div>
        </div>

        <div className="hidden w-full flex-col gap-5 md:flex">
          <Suspense fallback={<div className="h-72 w-full animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" aria-hidden="true" />}>
            <CalendarView
              beadsRecords={beadsRecords}
              meditationRecords={meditationRecords}
              currentBeads={totalBeads}
              compact
              wide
              splitLayout
              titleKey="Beads Count Record"
              hideSelectedMeditationTime
              hideBeadsRoundProgress
              hideCalendarLegend
              language={language}
            />
            <RecentPracticeActivity type="beads" records={beadsRecords} wide language={language} />
          </Suspense>
        </div>
      </div>

    </div>
  )
}
