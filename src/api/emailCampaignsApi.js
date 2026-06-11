import { base44 } from "@/api/base44Client";

// Thin wrapper over the emailCampaigns backend function (admin session is
// attached automatically by base44Client).
export async function campaignApi(action, payload = {}) {
  const res = await base44.functions.invoke("emailCampaigns", { action, ...payload });
  if (res?.data?.error) throw new Error(res.data.error);
  if (!res?.data || typeof res.data !== "object") throw new Error("No response from server");
  return res.data;
}
