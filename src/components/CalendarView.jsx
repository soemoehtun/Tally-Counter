import { useState, useMemo } from 'react'
import { translate } from '../utils/language'
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Clock
} from 'lucide-react'

const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WEEKDAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarView({ beadsRecords = [], meditationRecords = [], adhithanRecords = [], adhithanGoals = [], compact = false, wide = false, splitLayout = false, showMeditationTime = false, hideSelectedMeditationTime = false, hideBeadsRoundProgress = false, hideCalendarLegend = false, currentBeads = 0, meditationOnly = false, titleKey, language = 'en' }) {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const weekdaysShort = language === 'my' ? ['နွေ', 'လာ', 'ဂါ', 'ဟူး', 'ကြာ', 'သော', 'နေ'] : WEEKDAYS_SHORT
  const weekdaysFull = language === 'my' ? weekdaysShort : WEEKDAYS_FULL

  // Format date helper: YYYY-MM-DD
  const toDateStr = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const todayStr = toDateStr(new Date())

  // Aggregate records by YYYY-MM-DD
  const dateMap = useMemo(() => {
    const map = {}

    // Beads records
    if (!meditationOnly) {
      beadsRecords.forEach(r => {
        if (!r.created_at) return
        const d = toDateStr(new Date(r.created_at))
        if (!map[d]) map[d] = { beads: 0, mins: 0, adhithan: 0, sessions: [] }
        map[d].beads += r.count
        map[d].sessions.push({ type: 'beads', val: r.count, time: r.created_at })
      })
    }

    // Meditation records
    meditationRecords.forEach(r => {
      if (!r.created_at) return
      const d = toDateStr(new Date(r.created_at))
      if (!map[d]) map[d] = { beads: 0, mins: 0, adhithan: 0, sessions: [] }
      map[d].mins += r.duration_minutes
      map[d].sessions.push({ type: 'meditation', val: r.duration_minutes, time: r.created_at })
    })

    // Adhithan check-in dates are stored as local YYYY-MM-DD values.
    adhithanRecords.forEach(record => {
      if (!record.checkin_date) return
      const d = String(record.checkin_date).slice(0, 10)
      if (!map[d]) map[d] = { beads: 0, mins: 0, adhithan: 0, sessions: [] }
      map[d].adhithan += 1
      map[d].sessions.push({ type: 'adhithan', val: 1, goalId: record.goal_id, time: record.checkin_date })
    })

    return map
  }, [beadsRecords, meditationRecords, adhithanRecords, meditationOnly])

  // Calendar calculations for viewDate
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const dateLocale = language === 'my' ? 'my-MM' : 'en-US'
  const monthName = viewDate.toLocaleString(dateLocale, { month: 'long', year: 'numeric' })
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Navigation handlers
  const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1))
  const handleToday = () => {
    const now = new Date()
    setViewDate(now)
    setSelectedDateStr(toDateStr(now))
  }

  // Monthly stats
  const monthlyStats = useMemo(() => {
    let activeDays = 0
    let totalBeads = 0
    let totalMins = 0

    for (let day = 1; day <= daysInMonth; day++) {
      const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const entry = dateMap[d]
      if (entry && (entry.beads > 0 || entry.mins > 0 || entry.adhithan > 0)) {
        activeDays++
        totalBeads += entry.beads
        totalMins += entry.mins
      }
    }

    return { activeDays, totalBeads, totalMins }
  }, [dateMap, year, month, daysInMonth])

  // Selected date record details
  const selectedEntry = dateMap[selectedDateStr] || { beads: 0, mins: 0, adhithan: 0, sessions: [] }
  const selectedDateBeads = meditationOnly ? 0 : selectedEntry.beads + (selectedDateStr === todayStr ? currentBeads : 0)
  const selectedDateRounds = Math.floor(selectedDateBeads / 108)
  const beadsIntoCurrentRound = selectedDateBeads % 108
  const selectedDateObj = new Date(`${selectedDateStr}T00:00:00`)
  const selectedFormatted = selectedDateObj.toLocaleDateString(dateLocale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  if (compact && splitLayout) {
    return (
      <section className={`flex w-full ${wide ? 'max-w-none' : 'max-w-[760px]'} min-h-[352px] flex-col rounded-md border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-[#181818] sm:p-5 md:h-[352px]`}>
        <header className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {translate(titleKey || (meditationOnly ? 'Meditation Calendar' : 'Calendar Record'), language)}
            </h3>
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {translate(meditationOnly ? 'Select a day to view meditation history' : 'Select a day to view daily practice history', language)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleToday} className="rounded px-2 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">{translate('Today', language)}</button>
            <button onClick={handlePrevMonth} title={translate('Previous month', language)} aria-label={translate('Previous month', language)} className="grid h-8 w-8 place-items-center rounded text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"><ChevronLeft size={15} /></button>
            <span className="min-w-[118px] text-center text-xs font-semibold text-zinc-800 dark:text-zinc-200">{monthName}</span>
            <button onClick={handleNextMonth} title={translate('Next month', language)} aria-label={translate('Next month', language)} className="grid h-8 w-8 place-items-center rounded text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"><ChevronRight size={15} /></button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="flex min-w-0 flex-col justify-between">
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekdaysShort.map((day, idx) => <span key={`${day}-${idx}`} className="py-1 text-[10px] font-semibold text-zinc-400">{day}</span>)}
              {Array.from({ length: firstDayOfWeek }, (_, idx) => <span key={`blank-${idx}`} />)}
              {Array.from({ length: daysInMonth }, (_, idx) => {
                const day = idx + 1
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const entry = dateMap[dateStr]
                const hasBeads = !meditationOnly && Boolean(entry?.beads)
                const hasMeditation = Boolean(entry?.mins)
                const hasAdhithan = Boolean(entry?.adhithan)
                const isSelected = selectedDateStr === dateStr
                const isToday = todayStr === dateStr
                return (
                  <button key={dateStr} type="button" onClick={() => setSelectedDateStr(dateStr)} aria-pressed={isSelected} title={`${dateStr}${hasBeads ? ` • ${entry.beads} ${translate('ပုတီး', language)}` : ''}${hasMeditation ? ` • ${entry.mins} ${translate('min meditation', language)}` : ''}${hasAdhithan ? ` • ${entry.adhithan} ${translate('check-ins', language)}` : ''}`} className={`relative flex h-9 flex-col items-center justify-center rounded-md text-xs transition-colors ${isSelected ? 'bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900' : isToday ? 'border border-zinc-500 text-zinc-900 dark:border-zinc-400 dark:text-zinc-100' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}>
                    {day}
                    {(hasBeads || hasMeditation || hasAdhithan) && <span className="absolute bottom-1 flex gap-0.5">
                      {hasBeads && <i className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />}
                      {hasMeditation && <i className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white/70' : 'bg-amber-500'}`} />}
                      {hasAdhithan && <i className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white/50' : 'bg-violet-500'}`} />}
                    </span>}
                  </button>
                )
              })}
            </div>

            {!hideCalendarLegend && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
              {!meditationOnly && <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{translate('ပုတီးစိပ်မှတ်တမ်း', language)}</span>}
              {adhithanRecords.length > 0 && <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-violet-500" />{translate('Adhithan check-ins', language)}</span>}
            </div>}
          </div>

          <aside className="flex min-h-[180px] flex-col rounded-md bg-zinc-50 p-3.5 dark:bg-zinc-900/50 md:min-h-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{translate('THIS MONTH', language)}</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{monthlyStats.activeDays}<span className="ml-1 text-xs font-normal text-zinc-400">{translate('practice days', language)}</span></p>
            <div className="my-3 border-t border-zinc-200 dark:border-zinc-700" />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{translate('SELECTED DATE', language)}</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-zinc-800 dark:text-zinc-200">{selectedFormatted}</p>
              </div>
            </div>
            {meditationOnly ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div><p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">{translate('MEDITATION TIME', language)}</p><p className="mt-1 font-mono text-xl font-bold leading-none text-amber-600 dark:text-amber-400">{selectedEntry.mins.toLocaleString()}</p><p className="mt-1 text-[10px] text-zinc-500">{translate('minutes', language)}</p></div>
                <div><p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">{translate('SESSIONS', language)}</p><p className="mt-1 font-mono text-xl font-bold leading-none text-zinc-900 dark:text-zinc-100">{selectedEntry.sessions.length.toLocaleString()}</p><p className="mt-1 text-[10px] text-zinc-500">{translate('all-time', language)}</p></div>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div><p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">{translate('ပုတီး', language)}</p><p className="mt-1 font-mono text-xl font-bold leading-none text-zinc-900 dark:text-zinc-100">{selectedDateBeads.toLocaleString()}</p><p className="mt-1 text-[10px] text-zinc-500">{translate('အကြိမ်ရေ', language)}</p></div>
                <div><p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">{translate('ROUNDS', language)}</p><p className="mt-1 font-mono text-xl font-bold leading-none text-emerald-700 dark:text-emerald-400">{selectedDateRounds.toLocaleString()}</p>{!hideBeadsRoundProgress && <p className="mt-1 text-[10px] text-zinc-500">{beadsIntoCurrentRound} / 108</p>}</div>
                {!hideSelectedMeditationTime && (showMeditationTime || selectedEntry.mins > 0) && <p className="col-span-2 flex items-center gap-1.5 text-[10px] text-zinc-500"><Clock size={12} />{selectedEntry.mins} {translate('minutes', language)}</p>}
              </div>
            )}
          </aside>
        </div>
      </section>
    )
  }

  if (compact) {
    return (
      <div className={`w-full ${wide ? 'h-full max-w-none' : 'max-w-[520px]'} rounded-md border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-[#181818] sm:p-5`}>
        <div className="mb-3 flex flex-col items-start justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {translate(titleKey || (meditationOnly ? 'Meditation Calendar' : 'Calendar Record'), language)}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              {translate(meditationOnly ? 'Select a day to view meditation history' : 'Select a day to view daily practice history', language)}
            </p>
          </div>
          <div className="flex items-center gap-1 self-end sm:self-auto">
            <button onClick={handlePrevMonth} title={translate('Previous month', language)} aria-label={translate('Previous month', language)} className="p-1.5 rounded text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
              <ChevronLeft size={15} />
            </button>
            <span className="min-w-[116px] text-center text-xs font-semibold text-zinc-800 dark:text-zinc-200">{monthName}</span>
            <button onClick={handleNextMonth} title={translate('Next month', language)} aria-label={translate('Next month', language)} className="p-1.5 rounded text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdaysShort.map((day, idx) => (
            <span key={`${day}-${idx}`} className="py-1 text-[10px] font-mono font-semibold text-zinc-500 dark:text-zinc-400">{day}</span>
          ))}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => <span key={`blank-${idx}`} />)}
          {Array.from({ length: daysInMonth }, (_, idx) => {
            const day = idx + 1
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const entry = dateMap[dateStr]
            const hasBeads = !meditationOnly && Boolean(entry?.beads)
            const hasMeditation = Boolean(entry?.mins)
            const hasAdhithan = Boolean(entry?.adhithan)
            const isSelected = selectedDateStr === dateStr
            const isToday = todayStr === dateStr
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDateStr(dateStr)}
                title={`${dateStr}${hasBeads ? ` • ${entry.beads} ${translate('ပုတီး', language)}` : ''}${hasMeditation ? ` • ${entry.mins} ${translate('min meditation', language)}` : ''}${hasAdhithan ? ` • ${entry.adhithan} ${translate('check-ins', language)}` : ''}`}
                aria-label={`${dateStr}${hasBeads ? `, ${entry.beads} ${translate('ပုတီး', language)}` : ''}${hasMeditation ? `, ${entry.mins} ${translate('minutes meditation', language)}` : ''}${hasAdhithan ? `, ${entry.adhithan} ${translate('check-ins', language)}` : ''}`}
                className={`relative h-9 rounded-md flex flex-col items-center justify-center text-xs transition-colors ${
                  isSelected
                    ? 'bg-emerald-600 text-white font-semibold'
                    : isToday
                      ? 'border border-emerald-500 text-emerald-700 dark:text-emerald-400'
                      : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {day}
                {(hasBeads || hasMeditation || hasAdhithan) && <span className="absolute bottom-1 flex gap-0.5">
                  {hasBeads && <span className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />}
                  {hasMeditation && <span className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white/70' : 'bg-amber-500'}`} />}
                  {hasAdhithan && <span className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white/50' : 'bg-violet-500'}`} />}
                </span>}
              </button>
            )
          })}
        </div>

        {!meditationOnly && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{translate('ပုတီးစိပ်မှတ်တမ်း', language)}</span>
            {adhithanRecords.length > 0 && <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-violet-500" />{translate('Adhithan check-ins', language)}</span>}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{translate('SELECTED DATE', language)}</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{selectedFormatted}</p>
            </div>
          </div>

          {meditationOnly ? (
            <div className="mt-3 flex items-stretch gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{translate('MEDITATION TIME', language)}</p>
                <p className="mt-0.5 text-2xl font-bold font-mono leading-none text-amber-600 dark:text-amber-400">
                  {selectedEntry.mins.toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{translate('minutes', language)}</p>
              </div>

              <div className="w-px bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />

              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{translate('SESSIONS', language)}</p>
                <p className="mt-0.5 text-2xl font-bold font-mono leading-none text-zinc-900 dark:text-zinc-100">
                  {selectedEntry.sessions.length.toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{translate('all-time', language)}</p>
              </div>
            </div>
          ) : (
            <div className={`mt-3 ${showMeditationTime ? 'grid grid-cols-3 divide-x divide-zinc-200 dark:divide-zinc-800' : 'flex items-stretch gap-4'}`}>
              <div className={`min-w-0 ${showMeditationTime ? 'px-2 first:pl-0' : 'flex-1'}`}>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{translate('ပုတီး', language)}</p>
                <p className={`mt-0.5 ${showMeditationTime ? 'text-xl sm:text-2xl' : 'text-2xl'} font-bold font-mono leading-none text-zinc-900 dark:text-zinc-100`}>
                  {selectedDateBeads.toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{translate('အကြိမ်ရေ', language)}</p>
              </div>

              {!showMeditationTime && <div className="w-px bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />}

              <div className={`min-w-0 ${showMeditationTime ? 'px-2' : 'flex-1'}`}>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{translate(showMeditationTime ? 'Adhithan check-ins' : 'ROUNDS', language)}</p>
                <p className={`mt-0.5 ${showMeditationTime ? 'text-xl sm:text-2xl' : 'text-2xl'} font-bold font-mono leading-none ${showMeditationTime ? 'text-violet-700 dark:text-violet-300' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {showMeditationTime ? selectedEntry.adhithan.toLocaleString() : selectedDateRounds.toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{showMeditationTime ? translate('check-ins', language) : `${beadsIntoCurrentRound} / 108`}</p>
              </div>

              {showMeditationTime && (
                <div className="min-w-0 px-2 last:pr-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{translate('MEDITATION TIME', language)}</p>
                  <p className="mt-0.5 text-xl sm:text-2xl font-bold font-mono leading-none text-amber-600 dark:text-amber-400">
                    {selectedEntry.mins.toLocaleString()}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{translate('minutes', language)}</p>
                </div>
              )}
            </div>
          )}

          {!meditationOnly && !showMeditationTime && selectedEntry.mins > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
              <Clock size={12} /> {selectedEntry.mins} minutes
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-screen-2xl mx-auto w-full flex flex-col gap-6 py-2">

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarIcon size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {translate(titleKey || (meditationOnly ? 'Meditation Calendar' : 'Calendar Record'), language)}
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            {translate('ပုတီးစိပ်နှင့် တရားထိုင်မှတ်တမ်းများကို လစဉ်ကြည့်ရှုရန်', language)}
          </p>
        </div>

        {/* Month Navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="sb-btn-secondary text-xs py-1 px-2.5 font-mono"
          >
            {translate('Today', language)}
          </button>
          <div className="flex items-center bg-white dark:bg-[#181818] border border-zinc-200 dark:border-zinc-800 rounded p-0.5 shadow-xs">
            <button
              onClick={handlePrevMonth}
              title={translate('Previous Month', language)}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs font-semibold px-3 text-zinc-800 dark:text-zinc-200 min-w-[130px] text-center font-mono">
              {monthName}
            </span>
            <button
              onClick={handleNextMonth}
              title={translate('Next Month', language)}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#181818] border border-zinc-200 dark:border-zinc-800 rounded-md p-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm">
              <CalendarIcon size={16} />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase text-zinc-500 dark:text-zinc-400">{translate('အဓိဋ္ဌာန် မှတ်တမ်း', language)}</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                {monthlyStats.activeDays} <span className="text-xs text-zinc-400 dark:text-zinc-500 font-normal">/ {daysInMonth} {translate('days', language)}</span>
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/30 px-2 py-0.5 rounded border">
            {Math.round((monthlyStats.activeDays / daysInMonth) * 100)}%
          </span>
        </div>

        <div className="bg-white dark:bg-[#181818] border border-zinc-200 dark:border-zinc-800 rounded-md p-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm">
              🧿
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase text-zinc-500 dark:text-zinc-400">{translate('ပုတီးစိတ်ခဲ့သော အကြိမ်အရေအတွက်', language)}</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {translate('ပုတီး', language)} {monthlyStats.totalBeads.toLocaleString()} {translate('အကြိမ်ရေ', language)}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
            {Math.floor(monthlyStats.totalBeads / 108)} {translate('ပတ်', language)}
          </span>
        </div>

        <div className="bg-white dark:bg-[#181818] border border-zinc-200 dark:border-zinc-800 rounded-md p-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm">
              🧘
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase text-zinc-500 dark:text-zinc-400">{translate('တရားထိုင်ခဲ့သည့်ကြာချိန်', language)}</p>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono">
                {monthlyStats.totalMins} <span className="text-xs text-zinc-400 dark:text-zinc-500 font-normal">{translate('minutes', language)}</span>
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
            {(monthlyStats.totalMins / 60).toFixed(1)} {translate('hrs', language)}
          </span>
        </div>
      </div>

      {/* Main Grid: Calendar + Selected Day Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── CALENDAR GRID ── */}
        <div className="lg:col-span-9 bg-white dark:bg-[#181818] rounded-md border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs flex flex-col">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {weekdaysFull.map((day, idx) => (
              <div key={`${day}-${idx}`} className="text-[11px] font-mono font-semibold text-zinc-500 dark:text-zinc-400 py-1 uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 gap-1.5 flex-1">
            {/* Blank leading padding */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-[72px] sm:min-h-[82px] rounded bg-zinc-50/50 dark:bg-[#131313]/40 border border-transparent" />
            ))}

            {/* Month Day Cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isToday = cellDateStr === todayStr
              const isSelected = cellDateStr === selectedDateStr
              const entry = dateMap[cellDateStr]
              const hasActivity = entry && (entry.beads > 0 || entry.mins > 0 || entry.adhithan > 0)

              return (
                <button
                  key={cellDateStr}
                  onClick={() => setSelectedDateStr(cellDateStr)}
                  className={`min-h-[72px] sm:min-h-[82px] p-1.5 rounded border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-50/90 border-emerald-500 shadow-xs dark:bg-zinc-800/90 dark:border-emerald-500'
                      : isToday
                        ? 'bg-emerald-50/40 border-emerald-500/60 hover:border-zinc-400 dark:bg-zinc-850/60 dark:border-emerald-500/50'
                        : hasActivity
                          ? 'bg-white border-zinc-200 hover:border-zinc-300 dark:bg-[#1b1b1b] dark:border-zinc-800 dark:hover:border-zinc-700'
                          : 'bg-zinc-50/60 border-zinc-100 hover:border-zinc-200 text-zinc-400 dark:bg-[#141414] dark:border-zinc-850/60 dark:hover:border-zinc-800 dark:text-zinc-600'
                  }`}
                >
                  {/* Top row: day number + today marker */}
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs font-mono font-medium ${
                      isSelected
                        ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                        : isToday
                          ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                          : hasActivity
                            ? 'text-zinc-800 dark:text-zinc-200 font-semibold'
                            : 'text-zinc-500 dark:text-zinc-400'
                    }`}>
                      {day}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </div>

                  {/* Badges for activity on this date */}
                  <div className="flex flex-col gap-1 w-full mt-1">
                    {entry?.beads > 0 && (
                      <div className="text-[9px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20 px-1 py-0.2 rounded truncate flex items-center gap-0.5">
                        <span>🧿</span>
                        <span className="truncate">{entry.beads}</span>
                      </div>
                    )}
                    {entry?.mins > 0 && (
                      <div className="text-[9px] font-mono text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20 px-1 py-0.2 rounded truncate flex items-center gap-0.5">
                        <span>🧘</span>
                        <span>{entry.mins}m</span>
                      </div>
                    )}
                    {entry?.adhithan > 0 && (
                      <div className="text-[9px] font-mono text-violet-700 bg-violet-50 border border-violet-200 dark:text-violet-300 dark:bg-violet-500/10 dark:border-violet-500/20 px-1 py-0.2 rounded truncate flex items-center gap-0.5">
                        <span>🪷</span><span className="truncate">{entry.adhithan}</span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Calendar Legend */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-850 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> {translate('ပုတီးစိပ်မှတ်တမ်း', language)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> {translate('Meditation sit', language)}
              </span>
            </div>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 hidden sm:inline">
              {translate('Click any date to see sessions', language)}
            </span>
          </div>
        </div>

        {/* ── SELECTED DATE DETAILS ── */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-white dark:bg-[#181818] rounded-md border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs flex flex-col justify-between h-full">
            <div>
              {/* Header */}
              <div className="border-b border-zinc-100 dark:border-zinc-850 pb-3 mb-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{translate('SELECTED DATE', language)}</p>
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mt-0.5">
                  {selectedFormatted}
                </h3>
              </div>

              {/* Day's Total Summary */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-zinc-50 dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800 rounded p-2.5">
                  <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{translate('ပုတီးစိတ်ခဲ့သော အကြိမ်အရေအတွက်', language)}</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    {selectedEntry.beads}
                  </p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                    {Math.floor(selectedEntry.beads / 108)} {translate('ပတ်', language)}
                  </p>
                </div>
                <div className="bg-zinc-50 dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800 rounded p-2.5">
                  <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{translate('တရားထိုင်ခဲ့သည့်ကြာချိန်', language)}</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                    {selectedEntry.mins} <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">{translate('min', language)}</span>
                  </p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                    {translate(selectedEntry.mins >= 30 ? 'Target met ✓' : 'Daily practice', language)}
                  </p>
                </div>
              </div>

              {/* Session log for selected date */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                  {translate('Session Log', language)} ({selectedEntry.sessions.length})
                </p>

                {selectedEntry.sessions.length === 0 ? (
                  <div className="text-center py-8 bg-zinc-50 dark:bg-[#141414] rounded border border-zinc-200 dark:border-zinc-850">
                    <p className="text-xl mb-1">🪷</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{translate('No practice recorded on this date.', language)}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                    {selectedEntry.sessions.map((s, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-50/80 dark:bg-[#141414] border border-zinc-200 dark:border-zinc-800 rounded p-2.5 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {s.type === 'beads' ? '🧿' : '🧘'}
                          </span>
                          <div>
                            <p className="font-medium text-zinc-800 dark:text-zinc-200">
                              {s.type === 'beads' ? `${translate('ပုတီး', language)} ${Number(s.val).toLocaleString()} ${translate('အကြိမ်ရေ', language)}` : `${s.val} min`}
                            </p>
                            <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                              {new Date(s.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20 px-1.5 py-0.5 rounded border">
                          ✓
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom info */}
            <div className="border-t border-zinc-100 dark:border-zinc-850 pt-3 mt-4 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
              <span>Namo Tassa Bhagavato 🙏</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">{translate('Dhamma Tracker', language)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
