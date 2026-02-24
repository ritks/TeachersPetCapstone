export default function EntryPage({ onStudentEntry, onTeacherEntry, onGuestEntry }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-purple-50 flex flex-col items-center justify-center px-4">
      <div className="mb-10 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-white text-xl font-bold">TP</span>
        </div>
        <h1 className="text-4xl font-bold text-gray-800 tracking-tight">Teacher's Pet</h1>
        <p className="text-gray-500 mt-2 text-lg">AI-Powered Math Tutor</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">
        <button
          onClick={onStudentEntry}
          className="flex-1 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white p-8 flex flex-col items-center gap-3 shadow-md hover:shadow-xl hover:from-blue-600 hover:to-blue-700 transition-all group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white/80 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 14c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
            <circle cx="12" cy="8" r="4" />
          </svg>
          <span className="text-xl font-semibold">I'm a Student</span>
          <span className="text-blue-100 text-sm text-center">Enter your course code to start learning</span>
        </button>

        <button
          onClick={onTeacherEntry}
          className="flex-1 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-8 flex flex-col items-center gap-3 shadow-md hover:shadow-xl hover:from-purple-700 hover:to-indigo-700 transition-all group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white/80 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
          <span className="text-xl font-semibold">I'm a Teacher</span>
          <span className="text-purple-200 text-sm text-center">Manage modules and view analytics</span>
        </button>

        <button
          onClick={onGuestEntry}
          className="flex-1 rounded-2xl bg-white border-2 border-gray-200 text-gray-700 p-8 flex flex-col items-center gap-3 shadow-md hover:shadow-xl hover:border-gray-300 hover:bg-gray-50 transition-all group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-gray-400 group-hover:text-gray-600 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-xl font-semibold">Just Chat</span>
          <span className="text-gray-400 text-sm text-center">Continue without signing in</span>
        </button>
      </div>
    </div>
  )
}
