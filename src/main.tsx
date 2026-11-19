import React from 'react';
import ReactDOM from 'react-dom/client';
import './theme-config.css';

const visitor = /^\/g\/([^/]+)\/?$/.exec(window.location.pathname);
async function render() {
  const page = visitor
    ? React.createElement((await import('./components/Galleries/ExhibitionPage.tsx')).default, {
        slug: visitor[1],
      })
    : React.createElement((await import('./App.tsx')).default);
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>{page}</React.StrictMode>,
  );
}
void render();
