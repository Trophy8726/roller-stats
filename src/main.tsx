import '@fontsource-variable/inter';
import './styles/theme.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthContext';
import { App } from './App';
import { defaultSyncDeps, SyncProvider } from './events/SyncContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SyncProvider deps={defaultSyncDeps()}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SyncProvider>
  </StrictMode>,
);
