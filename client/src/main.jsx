import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LoadingProvider } from './hooks/LoadingProvider.jsx'
import { AuthProvider } from './hooks/userAuth.js'

createRoot(document.getElementById('root')).render(

  <StrictMode>
    <LoadingProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LoadingProvider>
  </StrictMode>,
)

