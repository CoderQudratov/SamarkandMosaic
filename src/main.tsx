import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/app/App';
import { bootstrap } from '@/app/bootstrap';

bootstrap().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
