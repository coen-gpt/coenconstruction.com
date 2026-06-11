import { useState, useEffect, useCallback } from "react";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";

/**
 * Session gate for employee-facing pages outside the backend shell (/field,
 * /staff/time-off). Uses the SAME company login as the office backend — one
 * AdminUser account per employee, no separate app-user accounts.
 *
 * When there's no session, the page renders the shared AdminLogin inline
 * (URL stays put — crew bookmark /field and sign in right there).
 */
export function useEmployeeSession() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let session = null;
    try { session = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "null"); } catch { /* corrupt session */ }
    if (!session?.session_token) {
      setLoading(false);
      return;
    }
    base44.functions.invoke("adminAuth", { action: "verifySession" })
      .then((res) => {
        if (res.data?.error) throw new Error(res.data.error);
        const fresh = { ...session, ...res.data, session_token: session.session_token };
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(fresh));
        setUser(fresh);
      })
      .catch(() => {
        localStorage.removeItem(ADMIN_SESSION_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Handed to AdminLogin — persists the session and unlocks the page in place
  const onLogin = useCallback((u) => {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  return { user, loading, onLogin };
}
