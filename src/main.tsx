import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { bootstrapEarlyBranding } from './services/earlyBrandingBootstrap';

async function startApplication() {
  await bootstrapEarlyBranding().catch(() => undefined);

  document.getElementById('initial-branding-splash')?.remove();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void startApplication();

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => undefined);
  });
}
