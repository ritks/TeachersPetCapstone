import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'

const StudentContext = createContext(null)

function loadStoredStudent() {
  const raw = localStorage.getItem('tp_student')
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (data?.courseCode && data?.moduleId) return data
  } catch {
    /* ignore */
  }
  return null
}

export function StudentProvider({ children }) {
  const { currentUser } = useAuth()
  const [studentData, setStudentDataState] = useState(() => loadStoredStudent())
  const [selectedStudentModule, setSelectedStudentModule] = useState(null)
  // Registry maps moduleId → full module object for authenticated student navigation
  const moduleRegistryRef = useRef({})

  // Clear guest data whenever any authenticated user signs in
  useEffect(() => {
    if (!currentUser) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedStudentModule(null)
    setStudentDataState(null)
    localStorage.removeItem('tp_student')
    moduleRegistryRef.current = {}
  }, [currentUser])

  const setStudentData = (data) => {
    if (data) {
      localStorage.setItem('tp_student', JSON.stringify(data))
    } else {
      localStorage.removeItem('tp_student')
    }
    setStudentDataState(data)
  }

  const clearStudent = () => {
    localStorage.removeItem('tp_student')
    setStudentDataState(null)
    setSelectedStudentModule(null)
    moduleRegistryRef.current = {}
  }

  const registerModule = (moduleId, moduleData) => {
    moduleRegistryRef.current[moduleId] = moduleData
  }

  const getModule = (moduleId) => moduleRegistryRef.current[moduleId] ?? null

  return (
    <StudentContext.Provider
      value={{
        studentData,
        setStudentData,
        selectedStudentModule,
        setSelectedStudentModule,
        clearStudent,
        registerModule,
        getModule,
      }}
    >
      {children}
    </StudentContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStudent() {
  const ctx = useContext(StudentContext)
  if (!ctx) throw new Error('useStudent must be used within a StudentProvider')
  return ctx
}
