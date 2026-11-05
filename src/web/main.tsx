import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Fant ikke #root i index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
