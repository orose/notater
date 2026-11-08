import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './app/fonts';
// Kanonisk kilde for alle tokens (docs/design/tokens.css) – importeres som den er.
import '../../docs/design/tokens.css';
import './app/global.css';
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
