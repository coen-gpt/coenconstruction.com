import { base44 } from "@/api/base44Client";

/**
 * Field-crew data access. All field app reads/writes go through the
 * `fieldCrewProjects` backend function, which verifies the Base44 login and
 * enforces ownership server-side — so the field entities can be RLS-locked
 * without breaking the app.
 *
 * Throws an Error whose message is the server's error string, so callers can
 * surface it directly in a toast.
 */
export async function fieldApi(action, payload = {}) {
  try {
    const res = await base44.functions.invoke("fieldCrewProjects", { action, ...payload });
    if (res?.data?.error) throw new Error(res.data.error);
    return res?.data || {};
  } catch (err) {
    const serverMsg = err?.response?.data?.error || err?.data?.error;
    throw new Error(serverMsg || err?.message || "Request failed — check your connection.");
  }
}
