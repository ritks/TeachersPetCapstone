import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { StudentProvider } from './contexts/StudentContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <StudentProvider>
          <App />
        </StudentProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
