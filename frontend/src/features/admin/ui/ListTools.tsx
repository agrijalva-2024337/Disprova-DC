import type { ReactNode } from 'react'

export function ModuleHead({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{text}</p>
      </div>
      {action}
    </div>
  )
}

export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-full bg-slate-900 px-5 text-sm font-medium text-white"
    >
      {children}
    </button>
  )
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-h-11 w-full max-w-sm rounded-full border border-slate-300 bg-white px-4 text-sm"
    />
  )
}
