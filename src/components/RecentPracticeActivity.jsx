import { useEffect, useMemo, useState } from 'react'
import { translate } from '../utils/language'

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function RecentPracticeActivity({ type, records = [], language = 'en', wide = false }) {
  const [now, setNow] = useState(() => new Date())
  const isBeads = type === 'beads'
  const typeLabel = isBeads ? 'Bead' : 'Meditation'

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const activities = useMemo(() => {
    const today = localDateKey(now)

    return records
      .map(record => ({ record, date: new Date(record.created_at) }))
      .filter(({ record, date }) => record.created_at && !Number.isNaN(date.getTime()) && localDateKey(date) === today)
      .sort((a, b) => b.date - a.date)
  }, [records, now])

  const locale = language === 'my' ? 'my-MM' : 'en-US'
  const dateFormatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })

  return (
    <section className={`flex h-64 w-full ${wide ? 'max-w-none' : 'max-w-[520px]'} flex-col overflow-hidden rounded-md border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-[#181818] sm:p-5`}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
        <div>
          <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
            {translate(`Recent ${typeLabel} Activity`, language)}
          </h3>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{translate(`Today's saved ${typeLabel.toLowerCase()} sessions`, language)}</p>
        </div>
      </div>

      {activities.length === 0 ? (
        <p className="flex min-h-0 flex-1 items-center justify-center text-center text-xs text-zinc-500 dark:text-zinc-400">
          {translate(`No ${typeLabel.toLowerCase()} sessions saved today.`, language)}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-zinc-100 pr-1 dark:divide-zinc-800">
          {activities.map(({ record, date }) => {
            const amount = Number(isBeads ? record.count : record.duration_minutes) || 0
            const title = isBeads
              ? language === 'my'
                ? `ပုတီး ${amount.toLocaleString()} အကြိမ်ရေ`
                : `${amount.toLocaleString()} mala beads`
              : language === 'my'
                ? `${amount.toLocaleString()} မိနစ် တရားထိုင်ခြင်း`
                : `${amount.toLocaleString()}m meditation session`
            const detail = isBeads
              ? `${Math.round((amount / 108) * 10) / 10} ${translate('rounds completed', language)}`
              : translate('Anapanasati practice', language)
            const key = record.id || `${record.created_at}-${amount}`

            return (
              <div key={key} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <div className="flex min-w-0 items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-800 dark:text-zinc-200">{title}</p>
                    <p className="truncate text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{detail}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">{dateFormatter.format(date)}</span>
                  <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">{timeFormatter.format(date)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
