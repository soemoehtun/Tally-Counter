import { ChevronDown, Plus } from 'lucide-react'

export default function SplitActionButton({ label, onClick }) {
  return (
    <div className="relative flex h-9 w-9 shrink-0 sm:ml-1 sm:h-8 sm:w-auto">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        className="inline-flex h-full w-full items-center justify-center text-zinc-700 dark:text-zinc-200 sm:w-auto sm:gap-1.5 sm:rounded-l sm:bg-[#55785c] sm:px-2.5 sm:text-sm sm:font-medium sm:leading-none sm:text-white sm:transition sm:hover:bg-[#486b50]"
      >
        <Plus size={20} className="shrink-0 sm:h-[15px] sm:w-[15px]" />
        <span className="relative top-px hidden h-full items-center leading-none sm:inline-flex">{label}</span>
      </button>
      <button
        type="button"
        aria-label={`${label} options`}
        title={`${label} options`}
        onClick={onClick}
        className="hidden h-full w-7 shrink-0 place-items-center rounded-r border-l border-white/20 bg-[#55785c] text-white transition hover:bg-[#486b50] sm:grid"
      >
        <ChevronDown size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
