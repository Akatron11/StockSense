import { authFetch } from "./client";
import type { BranchCreatePayload, BranchOut, RegionCreatePayload, RegionOut } from "../types/org";

export function listRegions(token: string): Promise<RegionOut[]> {
  return authFetch<RegionOut[]>(token, "/api/regions");
}

export function listBranches(token: string, regionId?: number): Promise<BranchOut[]> {
  const qs = regionId !== undefined ? `?region_id=${regionId}` : "";
  return authFetch<BranchOut[]>(token, `/api/branches${qs}`);
}

export function createRegion(token: string, payload: RegionCreatePayload): Promise<RegionOut> {
  return authFetch<RegionOut>(token, "/api/regions", { method: "POST", body: JSON.stringify(payload) });
}

export function createBranch(token: string, payload: BranchCreatePayload): Promise<BranchOut> {
  return authFetch<BranchOut>(token, "/api/branches", { method: "POST", body: JSON.stringify(payload) });
}
