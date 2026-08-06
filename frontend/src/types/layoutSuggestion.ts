// backend/app/schemas/layout_suggestion.py ile birebir eşleşir.
export interface LayoutSuggestionItem {
  product_a_id: number;
  product_a_name: string;
  product_b_id: number;
  product_b_name: string;
  score: number;
  applied: boolean;
  applied_at: string | null;
  applied_by: number | null;
}

export interface LayoutSuggestionOut {
  method: "co_occurrence" | "apriori";
  branch_sales_count: number;
  suggestions: LayoutSuggestionItem[];
}

export interface LayoutSuggestionApplyOut {
  product_a_id: number;
  product_b_id: number;
  applied: boolean;
  applied_at: string;
  applied_by: number;
}
