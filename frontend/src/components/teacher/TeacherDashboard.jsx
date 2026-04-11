import { useState } from 'react'
import AnalyticsDashboard from '../AnalyticsDashboard'
import { Button, Card } from '../ui/primitives'
import LogoMark from '../common/LogoMark'

function DashboardStat({ label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center flex-shrink-0`}>
        <span className="text-lg font-bold">{value}</span>
      </div>
      <span className="text-sm text-gray-600 font-medium">{label}</span>
    </div>
  )
}

function DashboardCard({ title, description, icon, tag, tagColor, onClick }) {
  const tagColors = {
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-indigo-100 text-indigo-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return (
    <Card
      onClick={onClick}
      className={[
        'p-5 flex flex-col gap-3 group',
        onClick ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
      interactive={!!onClick}
    >
      <div className="flex items-center justify-between">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-400 group-hover:text-indigo-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tagColors[tagColor]}`}>{tag}</span>
      </div>
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      <span className="text-xs text-indigo-600 font-medium mt-auto group-hover:underline">
        {onClick ? 'Open →' : 'Coming soon →'}
      </span>
    </Card>
  )
}

export default function TeacherDashboard({ onBack, onLogout, currentUser }) {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark containerClassName="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex-shrink-0 p-0.5" />
            <div>
              <h1 className="text-sm font-semibold text-gray-800">Teacher Dashboard</h1>
              <p className="text-xs text-gray-400">
                {currentUser?.displayName || currentUser?.email || "Teacher's Pet"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onBack}
              variant="secondary"
              size="md"
            >
              ← Back to Chat
            </Button>
            <Button
              onClick={onLogout}
              variant="secondary"
              size="md"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Welcome back{currentUser?.displayName ? `, ${currentUser.displayName.split(' ')[0]}` : ''}!
            </h2>
            <p className="text-gray-500 mt-1">Here&apos;s an overview of your classroom.</p>
          </div>

          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
            <Button
              onClick={() => setActiveTab('overview')}
              variant={activeTab === 'overview' ? 'secondary' : 'ghost'}
              size="md"
              className={[
                activeTab === 'overview' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              Overview
            </Button>
            <Button
              onClick={() => setActiveTab('analytics')}
              variant={activeTab === 'analytics' ? 'secondary' : 'ghost'}
              size="md"
              className={[
                activeTab === 'analytics' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              Analytics
            </Button>
          </div>

          {activeTab === 'analytics' ? (
            <AnalyticsDashboard />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <DashboardStat label="Active Students" value="--" color="blue" />
                <DashboardStat label="Modules" value="--" color="purple" />
                <DashboardStat label="Documents" value="--" color="amber" />
                <DashboardStat label="Chat Sessions" value="--" color="green" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <DashboardCard
                  title="Student Performance"
                  description="View student progress, session history, and identify areas where students need extra help."
                  icon={<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />}
                  tag="Analytics"
                  tagColor="blue"
                  onClick={() => setActiveTab('analytics')}
                />
                <DashboardCard
                  title="Manage Modules"
                  description="Create, edit, and organize teaching modules. Assign grade levels and topics for targeted tutoring."
                  icon={<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>}
                  tag="Content"
                  tagColor="purple"
                  onClick={onBack}
                />
                <DashboardCard
                  title="Upload Textbooks"
                  description="Upload PDF or text files to modules. Documents are chunked and embedded for AI-powered tutoring."
                  icon={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></>}
                  tag="Upload"
                  tagColor="amber"
                  onClick={onBack}
                />
                <DashboardCard
                  title="Manage Classes"
                  description="Organize students into classes, assign modules, and track class-wide performance metrics."
                  icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>}
                  tag="Classes"
                  tagColor="green"
                />
                <DashboardCard
                  title="Review Chat Logs"
                  description="Browse student chat sessions to understand common questions and improve module content."
                  icon={<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>}
                  tag="Sessions"
                  tagColor="indigo"
                  onClick={() => setActiveTab('analytics')}
                />
                <DashboardCard
                  title="Settings"
                  description="Configure AI behavior, safety filters, system prompts, and manage teacher account credentials."
                  icon={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>}
                  tag="Admin"
                  tagColor="gray"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
