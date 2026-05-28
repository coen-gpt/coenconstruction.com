import { Outlet, useLocation } from "react-router-dom";
import ExitIntentPopup from "./ExitIntentPopup";
import { useEffect } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import useTrackingInjection from "@/hooks/useTrackingInjection";
import { getLangFromPath } from "@/lib/i18n";

export default function WebsiteLayout() {
  const { pathname } = useLocation();
  useTrackingInjection();

  // Keep <html lang="…"> in sync with the active language
  useEffect(() => {
    const lang = getLangFromPath(pathname);
    document.documentElement.lang = lang.hreflang; // e.g. "en-US"
  }, [pathname]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  // Load Base44 chat widget
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://app.base44.com/chat-widget.js';
    script.async = true;
    document.body.appendChild(script);
    return () => script.remove();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ExitIntentPopup />
    </div>
  );
}