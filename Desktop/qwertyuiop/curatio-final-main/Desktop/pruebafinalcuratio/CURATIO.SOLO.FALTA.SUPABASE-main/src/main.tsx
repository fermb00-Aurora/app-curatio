
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n/i18n'
import { AppProvider } from './contexts/AppContext'
import { Toaster } from './components/ui/toaster'

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <I18nextProvider i18n={i18n}>
      <AppProvider>
        <App />
        <Toaster />
      </AppProvider>
    </I18nextProvider>
  </BrowserRouter>
);
