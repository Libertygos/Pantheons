import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/fira-mono/400.css';
import '@fontsource/fira-mono/700.css';
import './index.css';
import { App } from './App.js';

const el = document.getElementById('root');
if (!el) throw new Error('#root missing');
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
