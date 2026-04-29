import { forwardRef } from 'react'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function AppShell({ children, className = '', ...props }) {
  return (
    <div className={cx('min-h-screen bg-[var(--color-bg-canvas)] text-[var(--color-text-primary)]', className)} {...props}>
      {children}
    </div>
  )
}

export function Panel({ children, className = '', ...props }) {
  return (
    <div
      className={cx(
        'bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-xl)] shadow-[var(--shadow-xs)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function Card({ children, className = '', interactive = false, ...props }) {
  return (
    <div
      className={cx(
        'bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-xl)] p-5',
        interactive && 'transition-all duration-200 hover:shadow-[var(--shadow-sm)] hover:border-[var(--color-border-strong)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]',
    brand: 'bg-[var(--color-brand-50)] text-[var(--color-brand-700)] border-[var(--color-brand-100)]',
    success: 'bg-[var(--color-success-50)] text-[var(--color-success-600)] border-transparent',
    warning: 'bg-[var(--color-warning-50)] text-[var(--color-warning-600)] border-transparent',
    danger: 'bg-[var(--color-danger-50)] text-[var(--color-danger-600)] border-transparent',
  }
  return (
    <span className={cx('inline-flex items-center border px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  const variants = {
    primary: 'tp-btn-primary border',
    secondary: 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-muted)]',
    ghost: 'bg-transparent text-[var(--color-text-secondary)] border border-transparent hover:bg-[var(--color-bg-muted)]',
    subtle: 'bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] border border-transparent hover:bg-[var(--color-border-subtle)]',
    danger: 'bg-[var(--color-danger-500)] text-white border border-[var(--color-danger-500)] hover:bg-[var(--color-danger-600)]',
  }
  const sizes = {
    sm: 'text-xs px-3 py-1.5 rounded-[var(--radius-sm)]',
    md: 'text-sm px-4 py-2 rounded-[var(--radius-md)]',
    lg: 'text-sm px-5 py-2.5 rounded-[var(--radius-lg)]',
    pill: 'text-sm px-6 py-2.5 rounded-[var(--radius-pill)]',
    icon: 'p-2 rounded-[var(--radius-pill)]',
  }
  return (
    <button
      type={type}
      className={cx(
        'font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function StatCard({ label, value, tone = 'blue' }) {
  const tones = {
    blue: 'from-[rgba(65,90,119,0.28)] to-[rgba(65,90,119,0.12)] text-[var(--color-text-primary)]',
    purple: 'from-[rgba(91,83,214,0.26)] to-[rgba(65,90,119,0.12)] text-[var(--color-text-primary)]',
    green: 'from-[rgba(45,106,79,0.24)] to-[rgba(65,90,119,0.1)] text-[var(--color-text-primary)]',
    amber: 'from-[rgba(186,147,74,0.24)] to-[rgba(65,90,119,0.1)] text-[var(--color-text-primary)]',
  }
  return (
    <div className="rounded-xl border border-[var(--color-border-card-subtle)] tp-card-surface-soft p-4 flex items-center gap-3">
      <div className={cx('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center font-semibold text-lg', tones[tone])}>
        {value}
      </div>
      <p className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</p>
    </div>
  )
}

export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cx(
        'w-full border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-100)] focus:border-[var(--color-brand-600)]',
        className,
      )}
      {...props}
    />
  )
})
