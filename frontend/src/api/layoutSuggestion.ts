import { authFetch } from "./client";
import type { LayoutSuggestionApplyOut, LayoutSuggestionOut } from "../types/layoutSuggestion";

export function getLayoutSuggestion(token: string): Promise<LayoutSuggestionOut> {
  return authFetch<LayoutSuggestionOut>(token, "/api/reports/layout-suggestion");
}

export function applyLayoutSuggestion(
  token: string,
  productAId: number,
  productBId: number,
): Promise<LayoutSuggestionApplyOut> {
  return authFetch<LayoutSuggestionApplyOut>(token, "/api/reports/layout-suggestion/apply", {
    method: "POST",
    body: JSON.stringify({ product_a_id: productAId, product_b_id: productBId }),
  });
}
