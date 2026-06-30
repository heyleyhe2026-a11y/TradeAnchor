import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { captureSignupAttribution } from '../utils/signupAttribution';

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

let gaScriptLoaded = false;

function loadGaScript(measurementId: string): Promise<void> {
  if (gaScriptLoaded || typeof window.gtag === 'function') {
    gaScriptLoaded = true;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
    window.gtag('js', new Date());

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.onload = () => {
      gaScriptLoaded = true;
      resolve();
    };
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

function trackGaPageView(path: string) {
  if (!GA_ID || typeof window.gtag !== 'function') return;
  window.gtag('config', GA_ID, { page_path: path });
}

/** GA4 page views + refresh attribution when route search params change. */
export default function AnalyticsInit() {
  const location = useLocation();

  useEffect(() => {
    if (!GA_ID) return;
    void loadGaScript(GA_ID).then(() => {
      window.gtag?.('config', GA_ID, { send_page_view: false });
    });
  }, []);

  useEffect(() => {
    captureSignupAttribution();
    trackGaPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}
