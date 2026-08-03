import { authFetch } from "./client";
import type { BrandingOut, BrandingUpdatePayload, CompanyOut, FeatureOut } from "../types/company";

export function listCompanies(token: string): Promise<CompanyOut[]> {
  return authFetch<CompanyOut[]>(token, "/api/companies");
}

export function getFeatures(token: string, companyId: number): Promise<FeatureOut[]> {
  return authFetch<FeatureOut[]>(token, `/api/companies/${companyId}/features`);
}

export function updateFeature(token: string, companyId: number, featureName: string, enabled: boolean): Promise<FeatureOut> {
  return authFetch<FeatureOut>(token, `/api/companies/${companyId}/features/${featureName}`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

export function getBranding(token: string, companyId: number): Promise<BrandingOut> {
  return authFetch<BrandingOut>(token, `/api/companies/${companyId}/branding`);
}

export function updateBranding(token: string, companyId: number, payload: BrandingUpdatePayload): Promise<BrandingOut> {
  return authFetch<BrandingOut>(token, `/api/companies/${companyId}/branding`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
