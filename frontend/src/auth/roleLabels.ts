// backend/app/models/staff.py VALID_ROLES ile birebir eşleşir — TR görüntü etiketleri.
const ROLE_LABELS: Record<string, string> = {
  cashier: "Kasiyer",
  branch_manager: "Şube Müdürü",
  region_manager: "Bölge Müdürü",
  general_manager: "Genel Müdür",
  stock_manager: "Stock Manager",
  seller_manager: "Seller Manager",
  operations_chief: "Operasyon Şefi",
  company_it: "Şirket IT",
  vendor_manager: "Satıcı Yöneticisi",
  staff: "Personel",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
