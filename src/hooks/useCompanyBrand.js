import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Returns company profile data and derived brand colors for use in layout/UI.
 * Falls back to Coen Construction defaults if no profile is set.
 */
export function useCompanyBrand() {
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => base44.entities.CompanyProfile.list(),
    staleTime: 1000 * 60 * 5,
  });

  const profile = profiles[0] || {};

  const brandColor = profile.brand_color || "#E35235";
  const logoUrl = profile.logo_url || null;
  const companyName = profile.company_name || "Coen Construction";
  const phone = profile.phone || "";
  const email = profile.email || "";

  return { profile, brandColor, logoUrl, companyName, phone, email, isLoading };
}