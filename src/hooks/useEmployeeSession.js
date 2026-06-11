import { useState, useEffect } from "react";
import { base44, ADMIN_SESSION_KEY } from "@/api/base44Client";

/**
 * Session gate for employee-facing pages outside the backend shell (/field,
 * /staff/time-off). Uses the SAME company login as the office backend — one
 * AdminUser account per employee, no separate app-user accounts.
 *
 * No session (or a stale one) → bounce to /admin, where AdminLogin renders;
 * after signing in, field_crew accounts are routed back to /field by
 * BackendLayout.
 */
export function useEmployeeSession() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let session = null;
    try { session = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "null"); } catch { /* corrupt session */ }
    if (!session?.session_token) {
      window.location.replace("/admin");
      return;
    }
    base44.functions.invoke("adminAuth", { action: "verifySession" })
      .then((res) => {
        if (res.data?.error) throw new Error(res.data.error);
        const fresh = { ...session, ...res.data, session_token: session.session_token };
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(fresh));
        setUser(fresh);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem(ADMIN_SESSION_KEY);
        window.location.replace("/admin");
      });
  }, []);

  return { user, loading };
}
