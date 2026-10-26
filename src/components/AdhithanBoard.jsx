import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { CheckCircle2, Clock, Trophy, Loader2, CalendarDays, Target, Trash2 } from 'lucide-react'
import AdhithanCalendar from './AdhithanCalendar'
import { translate } from '../utils/language'
import SplitActionButton from './SplitActionButton'

const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const missingCheckinsTable = error => error?.code === 'PGRST205' || error?.code === '42P01' || /adhithan_checkins.*schema cache/i.test(error?.message || '')

export default function AdhithanBoard({ userId, onSaved, language = 'en' }) {
  const [goals, setGoals]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ title: '', total_days: '' })
  const [submitting, setSubmitting] = useState(false)
  const [checkingIn, setCheckingIn] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0)
  const [checkedInToday, setCheckedInToday] = useState({ date: localDateKey(), ids: [] })
  const [deletingGoal, setDeletingGoal] = useState(null)
  const showFeedback = (type, msg) => {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 3500)
  }

  const markCheckedInToday = goalId => setCheckedInToday(current => {
    const date = localDateKey()
    const ids = current.date === date ? current.ids : []
    return { date, ids: ids.includes(goalId) ? ids : [...ids, goalId] }
  })

  const fetchGoals = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('adhithan_trackers').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (!error) setGoals(data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  const fetchTodayCheckins = useCallback(async () => {
    const { data } = await supabase.from('adhithan_checkins')
      .select('goal_id')
      .eq('user_id', userId)
      .eq('checkin_date', localDateKey())
    setCheckedInToday({ date: localDateKey(), ids: (data || []).map(row => row.goal_id) })
  }, [userId])

  useEffect(() => { fetchTodayCheckins() }, [fetchTodayCheckins])

  const handleCheckIn = async (goal) => {
    if (goal.status === 'completed') return
    setCheckingIn(goal.id)
    const now = new Date()
    const checkinDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const { error: logError } = await supabase.from('adhithan_checkins').insert({
      user_id: userId,
      goal_id: goal.id,
      checkin_date: checkinDate,
    })
    if (logError) {
      setCheckingIn(null)
      if (logError.code === '23505') markCheckedInToday(goal.id)
      const message = logError.code === '23505'
        ? translate('You already checked in for this goal today.', language)
        : missingCheckinsTable(logError)
          ? translate('Check-in storage is not set up yet. Run adhithan_checkins_migration.sql in Supabase SQL Editor, then try again.', language)
          : `${translate('Check-in failed', language)}: ${logError.message}`
      showFeedback('error', message)
      return
    }
    const newCompleted = goal.completed_days + 1
    const newStatus = newCompleted >= goal.total_days ? 'completed' : 'ongoing'
    const { error } = await supabase.from('adhithan_trackers')
      .update({ completed_days: newCompleted, status: newStatus }).eq('id', goal.id)
    setCheckingIn(null)
    if (error) {
      await supabase.from('adhithan_checkins').delete().eq('user_id', userId).eq('goal_id', goal.id).eq('checkin_date', checkinDate)
      showFeedback('error', `${translate('Check-in failed', language)}: ${error.message}`)
    }
    else {
      markCheckedInToday(goal.id)
      setCalendarRefreshKey(key => key + 1)
      showFeedback('success', newStatus === 'completed'
        ? `🏆 "${goal.title}" ${translate('completed! Sādhu! Sādhu! Sādhu!', language)}`
        : `${translate('Day', language)} ${newCompleted} ${translate('checked in for', language)} "${goal.title}" 🙏`)
      fetchGoals()
      onSaved?.()
    }
  }

  const handleAddGoal = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { showFeedback('error', translate('Please enter a title.', language)); return }
    const days = parseInt(form.total_days, 10)
    if (!days || days < 1) { showFeedback('error', translate('Enter a valid number of days.', language)); return }
    setSubmitting(true)
    const { error } = await supabase.from('adhithan_trackers').insert({
      user_id: userId, title: form.title.trim(), total_days: days,
      completed_days: 0, status: 'ongoing',
      start_date: new Date().toISOString().split('T')[0],
    })
    setSubmitting(false)
    if (error) showFeedback('error', `${translate('Could not save goal', language)}: ${error.message}`)
    else { setForm({ title: '', total_days: '' }); setShowForm(false); fetchGoals(); onSaved?.() }
  }

  const handleDeleteGoal = async goal => {
    if (!window.confirm(`${translate('Are you sure you want to delete', language)} "${goal.title}"?`)) return
    setDeletingGoal(goal.id)
    const { error } = await supabase.from('adhithan_trackers').delete().eq('id', goal.id).eq('user_id', userId)
    setDeletingGoal(null)
    if (error) showFeedback('error', `${translate('Could not remove goal', language)}: ${error.message}`)
    else {
      setCheckedInToday(current => ({ ...current, ids: current.ids.filter(id => id !== goal.id) }))
      setCalendarRefreshKey(key => key + 1)
      showFeedback('success', `“${goal.title}” ${translate('removed.', language)}`)
      fetchGoals()
      onSaved?.()
    }
  }

  const ongoing   = goals.filter(g => g.status === 'ongoing')
  const completed = goals.filter(g => g.status === 'completed')

  const GoalCard = ({ goal }) => {
    const pct = Math.min(Math.round((goal.completed_days / goal.total_days) * 100), 100)
    const done = goal.status === 'completed'
    const busy = checkingIn === goal.id
    const checkedToday = checkedInToday.date === localDateKey() && checkedInToday.ids.includes(goal.id)
    return (
      <div className={`rounded-md border p-4 transition-all shadow-xs ${
        done
          ? 'border-amber-200 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/5'
          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-[#181818] dark:hover:border-zinc-700'
      }`}>
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 sm:flex sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {done ? <Trophy size={14} className="text-amber-500 shrink-0"/> : <Clock size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0"/>}
              <p className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">{goal.title}</p>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                done
                  ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
              }`}>
                {translate(done ? 'DONE' : 'ACTIVE', language)}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">{translate('Started', language)} {new Date(goal.start_date).toLocaleDateString()}</p>
          </div>
          <div className="col-start-2 row-span-2 flex flex-row items-center gap-2">
            {!done && (
              <button
                onClick={() => handleCheckIn(goal)}
                disabled={busy || checkedToday}
                className="sb-btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle2 size={12}/>}
                <span>{translate(checkedToday ? 'Checked in today' : 'Check-in', language)}</span>
              </button>
            )}
            {done && (
              <span className="text-[11px] font-mono font-medium text-amber-700 bg-amber-100 border border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30 px-2 py-0.5 rounded shrink-0">
                ✓ {translate('Completed', language)}
              </span>
            )}
            <button
              type="button"
              onClick={() => handleDeleteGoal(goal)}
              disabled={deletingGoal === goal.id}
              aria-label={`${translate('Remove', language)} ${goal.title}`}
              title={translate('Remove goal', language)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-zinc-200 p-0 text-[11px] font-medium text-zinc-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
            >
              {deletingGoal === goal.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </div>
        </div>

        <div className="mb-1.5 flex justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
          <span>{translate('Day', language)} {goal.completed_days} {translate('of', language)} {goal.total_days}</span>
          <span className={done ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${done ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-zinc-300 pb-4 dark:border-zinc-700 sm:flex-nowrap">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {language === 'my' ? 'အဓိဋ္ဌာန် မှတ်တမ်း' : 'Adhithan Tracker'}
            </h1>
          </div>
          <p className="mt-1.5 hidden text-sm text-zinc-500 dark:text-zinc-400 sm:block">{translate('Buddhist Vows & Streaks', language)}</p>
        </div>
        <SplitActionButton label={translate('New Goal', language)} onClick={() => setShowForm(v => !v)} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          {showForm && (
            <form onSubmit={handleAddGoal} className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-[#181818]">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{translate('Create new Adhithan Goal', language)}</p>
              <input className="sb-input" placeholder={translate('e.g. 108 Beads Daily for 90 Days', language)} value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
              <input className="sb-input" placeholder={translate('Total Days (e.g. 90)', language)} type="number" min="1" value={form.total_days} onChange={e => setForm(f => ({...f, total_days: e.target.value}))} />
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="sb-btn-primary flex-1 justify-center disabled:opacity-50">{submitting ? translate('Saving...', language) : translate('Save Goal', language)}</button>
                <button type="button" onClick={() => setShowForm(false)} className="sb-btn-secondary flex-1 justify-center">{translate('Cancel', language)}</button>
              </div>
            </form>
          )}

          {feedback && <div className={`rounded border px-3 py-2 text-center text-xs font-medium ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400'}`}>{feedback.msg}</div>}
          {loading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-emerald-600 dark:text-emerald-500" /></div>}

          {!loading && <div className="flex flex-col gap-2.5">
            {ongoing.length === 0 && completed.length === 0 && <div className="rounded-md border border-zinc-200 bg-white py-12 text-center shadow-xs dark:border-zinc-800/80 dark:bg-[#181818]"><p className="mb-2 text-3xl">🪷</p><p className="text-xs font-medium text-zinc-800 dark:text-zinc-400">{translate('No Adhithan goals yet', language)}</p><p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{translate('Create your first vow tracker to build daily momentum.', language)}</p></div>}
            {ongoing.map(goal => <GoalCard key={goal.id} goal={goal} />)}
          </div>}

          {!loading && completed.length > 0 && <div>
            <div className="mb-2 flex items-center gap-1.5"><Trophy size={13} className="text-amber-400" /><p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{translate('Completed Streaks', language)}</p></div>
            <div className="flex flex-col gap-2">{completed.map(goal => <GoalCard key={goal.id} goal={goal} />)}</div>
          </div>}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="hidden grid-cols-2 gap-3 sm:grid sm:grid-cols-3">
            <div className="rounded-md border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-[#181818]">
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><Target size={14} /><span className="text-[10px] font-semibold uppercase tracking-wide">{translate('Active Goals', language)}</span></div>
              <p className="mt-2 font-mono text-2xl font-bold">{ongoing.length}</p><p className="text-[10px] text-zinc-500 dark:text-zinc-400">{translate('Daily check-ins', language)}</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-[#181818]">
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><Trophy size={14} /><span className="text-[10px] font-semibold uppercase tracking-wide">{translate('Completed Streaks', language)}</span></div>
              <p className="mt-2 font-mono text-2xl font-bold">{completed.length}</p><p className="text-[10px] text-zinc-500 dark:text-zinc-400">{translate('All-time', language)}</p>
            </div>
            <div className="col-span-2 rounded-md border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-[#181818] sm:col-span-1">
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><CalendarDays size={14} /><span className="text-[10px] font-semibold uppercase tracking-wide">{translate('Days Completed', language)}</span></div>
              <p className="mt-2 font-mono text-2xl font-bold">{goals.reduce((total, goal) => total + goal.completed_days, 0).toLocaleString()}</p><p className="text-[10px] text-zinc-500 dark:text-zinc-400">{translate('Across all vows', language)}</p>
            </div>
          </section>
          <div className="hidden md:block">
            <AdhithanCalendar userId={userId} goals={goals} refreshKey={calendarRefreshKey} language={language} />
          </div>
        </div>

      </div>
    </div>
  )
}
