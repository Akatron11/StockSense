// backend/app/models/staff.py VALID_ROLES ile birebir eşleşir — i18n "roles" namespace'i altında.
const ROLE_KEYS: Record<string, string> = {
  cashier: "roles.cashier",
  branch_manager: "roles.branch_manager",
  region_manager: "roles.region_manager",
  general_manager: "roles.general_manager",
  stock_manager: "roles.stock_manager",
  seller_manager: "roles.seller_manager",
  operations_chief: "roles.operations_chief",
  company_it: "roles.company_it",
  vendor_manager: "roles.vendor_manager",
  staff: "roles.staff",
};

export function roleLabel(t: (key: string) => string, role: string): string {
  const key = ROLE_KEYS[role];
  return key ? t(key) : role;
}
