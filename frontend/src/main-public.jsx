import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import App from './App.jsx';
import { SchoolContentProvider } from './lib/content.jsx';
import { installRevealObserver, useScrollToTop } from './lib/motion.jsx';
import './styles/website.css';
import './styles/motion.css';

/** Restores scroll position (or jumps to a hash) whenever the route changes. */
function ScrollManager() {
  const location = useLocation();
  useScrollToTop(location.pathname, location.hash);
  return null;
}

function Root() {
  useEffect(() => installRevealObserver(), []);

  return (
    <SchoolContentProvider>
      <BrowserRouter>
        <ScrollManager />
        <App />
      </BrowserRouter>
    </SchoolContentProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
