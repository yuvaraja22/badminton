import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './lib/install'; // listen for the browser's install prompt as early as possible
import { startAppUpdates } from './lib/appUpdate';
import App from './App';

startAppUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
