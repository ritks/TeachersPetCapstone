import { APP_COPY } from '../../content/strings'
import { Button } from '../ui/primitives'

export default function TeacherHeader({ selectedModule, currentUser, onLogout, onDashboard }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-600 text-xs font-bold tracking-wider">TP</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">{APP_COPY.appName}</h1>
            <p className="text-xs text-gray-400">
              {selectedModule ? selectedModule.name : 'No module selected'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
