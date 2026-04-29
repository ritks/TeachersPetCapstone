import { APP_COPY } from '../../content/strings'
import { Button } from '../ui/primitives'
import LogoMark from '../common/LogoMark'
import { useTheme } from '../../contexts/ThemeContext'

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export default function TeacherHeader({ selectedModule, currentUser, onLogout, onDashboard }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] px-6 py-3 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LogoMark containerClassName="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex-shrink-0 p-0.5" />
          <div>
            <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">{APP_COPY.appName}</h1>
            <p className="text-xs text-[var(--color-text-muted)]">
              {selectedModule ? selectedModule.name : 'No module selected'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={toggleTheme}
            variant="secondary"
            size="md"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </Button>
          <Button
            onClick={onDashboard}
            variant="secondary"
            size="md"
          >
            Dashboard
          </Button>
          <Button
            onClick={onLogout}
            variant="secondary"
            size="md"
          >
            {currentUser?.displayName ? `Logout (${currentUser.displayName.split(' ')[0]})` : 'Logout'}
          </Button>
        </div>
      </div>
    </header>
  )
}
