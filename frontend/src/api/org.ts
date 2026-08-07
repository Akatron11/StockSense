import { authFetch } from "./client";
import type { BranchOut, RegionOut } from "../types/org";

export function listRegions(token: string): Promise<RegionOut[]> {
  return authFetch<RegionOut[]>(token, "/api/regions");
}

export function listBranches(token: string, regionId?: number): Promise<BranchOut[]> {
  const qs = regionId !== undefined ? `?region_id=${regionId}` : "";
  return authFetch<BranchOut[]>(token, `/api/branches${qs}`);
}
