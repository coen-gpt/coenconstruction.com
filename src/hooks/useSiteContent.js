import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Fetch a specific content key
export function useSiteContent(key) {
  return useQuery({
    queryKey: ["site-content", key],
    queryFn: async () => {
      const records = await base44.entities.AppSettings.filter({ key });
      if (records.length > 0) {
        try { return JSON.parse(records[0].value); } catch { return records[0].value; }
      }
      return null;
    },
    staleTime: 30000,
  });
}

// Fetch all content at once
export function useAllSiteContent() {
  return useQuery({
    queryKey: ["site-content-all"],
    queryFn: async () => {
      const records = await base44.entities.AppSettings.list();
      const map = {};
      for (const r of records) {
        try { map[r.key] = { id: r.id, value: JSON.parse(r.value) }; }
        catch { map[r.key] = { id: r.id, value: r.value }; }
      }
      return map;
    },
    staleTime: 30000,
  });
}

// Save content key
export function useSaveContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }) => {
      const stringVal = typeof value === "string" ? value : JSON.stringify(value);
      const existing = await base44.entities.AppSettings.filter({ key });
      if (existing.length > 0) {
        return base44.entities.AppSettings.update(existing[0].id, { key, value: stringVal });
      } else {
        return base44.entities.AppSettings.create({ key, value: stringVal });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-content"] });
      queryClient.invalidateQueries({ queryKey: ["site-content-all"] });
    },
  });
}