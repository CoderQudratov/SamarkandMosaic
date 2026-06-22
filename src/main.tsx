import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/app/App';
import { bootstrapSync, bootstrapAsync } from '@/app/bootstrap';

// ── Phase 1: synchronous init ─────────────────────────────────────────────
// Telegram SDK, theme CSS vars, safe area, user data from initDataUnsafe.
// All instant — zero network calls. Runs BEFORE React mounts so the first
// paint already has correct colors, safe area offsets, and player identity.
bootstrapSync();

// ── Phase 2: mount React immediately ─────────────────────────────────────
// SplashScreen is visible on the very next frame.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// ── Phase 3: async background work ───────────────────────────────────────
// Supabase + localStorage. Never blocks render. Failure is safe — the app
// runs on the mock/local player state already set in Phase 1.
bootstrapAsync().catch((err) => {
  // eslint-disable-next-line no-console
  console.warn('[main] Background bootstrap error (non-fatal):', err);
});
