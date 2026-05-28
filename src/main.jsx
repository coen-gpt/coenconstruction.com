import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initWebVitals } from '@/lib/webVitals'

// Initialize Google Analytics 4
const GA_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID;
if (GA_ID) {
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, { send_page_view: true });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Report Core Web Vitals after hydration (non-blocking)
initWebVitals()