// StockSense'in kendi ürün kimliği (2026-08-11, kullanıcıyla seçilen "Konsept A" — kutu+onay ikonu,
// #2563eb). Bir şirket kendi logosunu yüklememişse (AppShell sidebar'ı, LoginPage) bu gösterilir —
// eskiden düz "LOGO" metin yer tutucusuydu. Sabit marka rengi taşır (--brand-primary değil), çünkü bir
// müşterinin kendi teması bu markı yanlışlıkla boyamamalı — bu StockSense'in kendi kimliği.
const BRAND_BLUE = "#2563eb";

interface BrandMarkProps {
  size?: number;
}

export function BrandMark({ size = 40 }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={BRAND_BLUE}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="StockSense"
    >
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
      <path d="M8.5 12.2l2 2 4-4" strokeWidth={1.6} />
    </svg>
  );
}
