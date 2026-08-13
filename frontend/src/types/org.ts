// backend/app/schemas/org.py ile birebir eşleşir.
export interface RegionOut {
  id: number;
  name: string;
}

export interface BranchOut {
  id: number;
  name: string;
}

export interface RegionCreatePayload {
  company_id: number;
  name: string;
}

export interface BranchCreatePayload {
  region_id: number;
  name: string;
}
