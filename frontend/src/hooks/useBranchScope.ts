import { useEffect, useState } from "react";
import { listBranches } from "../api/org";
import type { BranchOut } from "../types/org";

// region_manager/general_manager'ın kendi branch_id'si yok (madde 9) — Stok/Fiyat gibi tek-şubelik
// ekranlarda hangi şubeyle çalışacaklarını kendileri seçmeli. branch_manager/stock_manager/seller_manager
// için hedef zaten örtük (kendi şubeleri), bu yüzden seçici hiç gösterilmez.
const BRANCH_SELECTOR_ROLES = new Set(["region_manager", "general_manager"]);

export function useBranchScope(role: string | undefined, token: string | null) {
  const needsSelector = role !== undefined && BRANCH_SELECTOR_ROLES.has(role);
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [branchId, setBranchId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!needsSelector || !token) return;
    listBranches(token).then((list) => {
      setBranches(list);
      setBranchId((current) => current ?? list[0]?.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSelector, token]);

  return { needsSelector, branches, branchId, setBranchId };
}
