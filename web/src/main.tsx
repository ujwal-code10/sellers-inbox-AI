import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { UIFeedbackProvider } from './context/UIFeedbackContext'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <UIFeedbackProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </UIFeedbackProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
