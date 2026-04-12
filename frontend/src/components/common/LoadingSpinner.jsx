import { APP_COPY } from '../../content/strings'
import { AppShell } from '../ui/primitives'

export default function LoadingSpinner() {
  return (
    <AppShell className="flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">{APP_COPY.loading}</p>
      </div>
    </AppShell>
  )
}
