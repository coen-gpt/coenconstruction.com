/**
 * RedirectHandler — handles client-side redirects from the REDIRECTS map.
 * Drop inside the Router in App.jsx, above the Routes block.
 * Uses React Router's Navigate for SPA redirects; logs 301/302 type to console in dev.
 */
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { findRedirect } from "@/lib/redirectMap";

export default function RedirectHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const result = findRedirect(location.pathname);
    if (!result) return;

    if (import.meta.env.DEV) {
      console.info(`[Redirect] ${result.type} ${location.pathname} → ${result.to}`);
    }

    navigate(result.to, { replace: result.type === 301 });
  }, [location.pathname]);

  return null;
}