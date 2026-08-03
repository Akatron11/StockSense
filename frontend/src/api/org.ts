import { authFetch } from "./client";
import type { BranchOut, RegionOut } from "../types/org";

export function listRegions(token: string): Promise<RegionOut[]> {
  return authFetch<RegionOut[]>(token, "/api/regions");
}

export function listBranches(token: string): Promise<BranchOut[]> {
  return authFetch<BranchOut[]>(token, "/api/branches");
}
