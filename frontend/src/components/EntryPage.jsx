export default function EntryPage({ onStudentEntry, onTeacherEntry, onGuestEntry }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="mb-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
            <ellipse cx="5.5" cy="6.5" rx="2.5" ry="3" />
            <ellipse cx="10" cy="4" rx="2" ry="2.5" />
            <ellipse cx="14.5" cy="4" rx="2" ry="2.5" />
            <ellipse cx="18.5" cy="6.5" rx="2" ry="2.5" />
            <path d="M12 9c-4.418 0-8 2.686-8 6 0 2.21 3.582 4 8 4s8-1.79 8-4c0-3.314-3.582-6-8-6z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Teacher's Pet</h1>
        <p className="text-gray-400 mt-2">AI-Powered Math Tutor</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl">
        <button
          onClick={onStudentEntry}
          className="flex-1 rounded-2xl bg-white border border-gray-200 p-8 flex flex-col items-center gap-3 hover:shadow-md hover:border-indigo-200 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 14c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
              <circle cx="12" cy="8" r="4" />
            </svg>
          </div>
          <span className="text-lg font-semibold text-gray-800">I'm a Student</span>
          <span className="text-sm text-gray-400 text-center">Enter your course code to start learning</span>
        </button>

        <button
          onClick={onTeacherEntry}
          className="flex-1 rounded-2xl bg-white border border-gray-200 p-8 flex flex-col items-center gap-3 hover:shadow-md hover:border-indigo-200 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <span className="text-lg font-semibold text-gray-800">I'm a Teacher</span>
          <span className="text-sm text-gray-400 text-center">Manage modules and view analytics</span>
        </button>

        <button
          onClick={onGuestEntry}
          className="flex-1 rounded-2xl bg-white border border-gray-200 p-8 flex flex-col items-center gap-3 hover:shadow-md hover:border-gray-300 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-400 group-hover:text-gray-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span className="text-lg font-semibold text-gray-800">Just Chat</span>
          <span className="text-sm text-gray-400 text-center">Continue without signing in</span>
        </button>
      </div>
    </div>
  )
}
