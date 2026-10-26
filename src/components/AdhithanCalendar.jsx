import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Loader2 } from 'lucide-react'
import { translate } from '../utils/language'

const toDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function AdhithanCalendar({ userId, goals, refreshKey, language = 'en' }) {
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const [error, setError] = useState('')

  const fetchCheckins = useCallback(async () => {
    setLoading(true)
    const { data, error: queryError } = await supabase.from('adhithan_checkins')
      .select('id, goal_id, checkin_date')
      .eq('user_id', userId)
      .order('checkin_date', { ascending: false })
    if (queryError) setError(queryError.code === 'PGRST205' || queryError.code === '42P01' || /adhithan_checkins.*schema cache/i.test(queryError.message || '')
      ? translate('Run adhithan_checkins_migration.sql in Supabase SQL Editor to enable calendar history.', language)
      : `${translate('Could not load calendar', language)}: ${queryError.message}`)
    else { setCheckins(data || []); setError('') }
    setLoading(false)
  }, [userId, language])

  useEffect(() => { fetchCheckins() }, [fetchCheckins, refreshKey])

  const entriesByDate = useMemo(() => checkins.reduce((entries, checkin) => {
    entries[checkin.checkin_date] = [...(entries[checkin.checkin_date] || []), checkin]
    return entries
  }, {}), [checkins])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthLabel = viewDate.toLocaleDateString(language === 'my' ? 'my-MM' : 'en-US', { month: 'long', year: 'numeric' })
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = toDateKey(new Date())
  const selectedLogs = entriesByDate[selectedDate] || []
  const activeDaysThisMonth = Object.keys(entriesByDate).filter(key => key.startsWith(`${year}-${String(month + 1).padStart(2, '0')}-`)).length
  const selectedLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(language === 'my' ? 'my-MM' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const weekdays = language === 'my' ? ['နွေ', 'လာ', 'ဂါ', 'ဟူး', 'ကြာ', 'သော', 'နေ'] : WEEKDAYS

  const shiftMonth = amount => setViewDate(date => new Date(date.getFullYear(), date.getMonth() + amount, 1))

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#181818] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-zinc-600 dark:text-zinc-300" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{language === 'my' ? 'အဓိဋ္ဌာန် ပြက္ခဒိန်' : 'Adhithan Calendar'}</h2>
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{translate('Your vow check-in history', language)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => { setViewDate(new Date()); setSelectedDate(today) }} className="rounded px-2 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">{translate('Today', language)}</button>
          <button type="button" onClick={() => shiftMonth(-1)} aria-label={translate('Previous month', language)} className="grid h-8 w-8 place-items-center rounded text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"><ChevronLeft size={15} /></button>
          <span className="min-w-[118px] text-center text-xs font-semibold">{monthLabel}</span>
          <button type="button" onClick={() => shiftMonth(1)} aria-label={translate('Next month', language)} className="grid h-8 w-8 place-items-center rounded text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"><ChevronRight size={15} /></button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdays.map((day, index) => <span key={`${day}-${index}`} className="py-1 text-[10px] font-semibold text-zinc-400">{day}</span>)}
            {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1
              const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const active = Boolean(entriesByDate[key]?.length)
              const isSelected = selectedDate === key
              const isToday = today === key
              return <button key={key} type="button" onClick={() => setSelectedDate(key)} aria-pressed={isSelected} title={active ? `${key} · ${entriesByDate[key].length} ${translate('check-ins', language)}` : key} className={`relative flex h-10 flex-col items-center justify-center rounded-md text-xs transition-colors ${isSelected ? 'bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900' : isToday ? 'border border-zinc-500 text-zinc-900 dark:border-zinc-400 dark:text-zinc-100' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}>
                {day}{active && <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-zinc-900 dark:bg-zinc-100'}`} />}
              </button>
            })}
          </div>
        </div>

        <aside className="rounded-md bg-zinc-50 p-3.5 dark:bg-zinc-900/50">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{translate('THIS MONTH', language)}</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{activeDaysThisMonth}<span className="ml-1 text-xs font-normal text-zinc-400"> {translate('practice days', language)}</span></p>
          <div className="my-3 border-t border-zinc-200 dark:border-zinc-700" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{translate('SELECTED DATE', language)}</p>
          <p className="mt-1 text-xs font-medium leading-relaxed">{selectedLabel}</p>
          <div className="mt-3 space-y-2">
            {loading ? <span className="flex items-center gap-1.5 text-[11px] text-zinc-500"><Loader2 size={12} className="animate-spin" />{translate('Loading…', language)}</span> : selectedLogs.length === 0 ? <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{translate('No vow check-ins on this date.', language)}</p> : selectedLogs.map(log => {
              const goal = goals.find(item => item.id === log.goal_id)
              return <div key={log.id} className="flex items-start gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-300"><CircleCheck size={13} className="mt-0.5 shrink-0" /><span>{goal?.title || 'Adhithan'} ✓</span></div>
            })}
          </div>
          {error && <p role="alert" className="mt-3 text-[10px] text-rose-600 dark:text-rose-400">{error}</p>}
        </aside>
      </div>
    </section>
  )
}
