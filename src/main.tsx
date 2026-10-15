import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/jost';
import './styles.css';

// Demo mode installs a fake window.plex with sample data before the app starts.
const demo = new URLSearchParams(location.search).has('demo');
(demo ? import('./demo').then((m) => m.install()) : Promise.resolve()).then(() =>
  createRoot(document.getElementById('root')!).render(<App />),
);
