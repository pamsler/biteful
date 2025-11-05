import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => {
        console.log('✅ Service Worker registriert:', registration.scope);
      })
      .catch(error => {
        console.log('❌ Service Worker Registrierung fehlgeschlagen:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);