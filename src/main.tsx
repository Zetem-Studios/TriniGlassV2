import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthProvider.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <ErrorBoundary>
      <ToastProvider>
        <StrictMode>
          <App />
        </StrictMode>
      </ToastProvider>
    </ErrorBoundary>
  </AuthProvider>
)