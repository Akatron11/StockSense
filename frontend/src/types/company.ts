// backend/app/schemas/company.py ile birebir eşleşir.
export interface CompanyOut {
  id: number;
  name: string;
  subdomain: string;
  is_active: boolean;
}

export interface FeatureOut {
  feature_name: string;
  enabled: boolean;
}

export interface BrandingOut {
  logo_url: string | null;
  primary_color: string | null;
  display_name: string;
}

export interface BrandingUpdatePayload {
  logo_url: string | null;
  primary_color: string | null;
  display_name: string;
}

export interface CompanyCreatePayload {
  name: string;
  subdomain: string;
}
