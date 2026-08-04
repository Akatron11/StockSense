const DARK_TEXT = "#3a3a3a";
const LIGHT_TEXT = "#ffffff";

function relativeLuminance(hex: string): number | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const r = channel(parseInt(clean.slice(0, 2), 16) / 255);
  const g = channel(parseInt(clean.slice(2, 4), 16) / 255);
  const b = channel(parseInt(clean.slice(4, 6), 16) / 255);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Şirketin seçtiği ana rengi --brand-primary olarak enjekte eder; nav aktif öğe, primary
// butonlar ve login butonu bunu kullanır (app.css/login.css). Kontrast için --brand-primary-fg
// da hesaplanır (koyu renk üstünde beyaz, açık renk üstünde koyu metin).
export function applyBrandColor(primaryColor: string | null | undefined): void {
  const root = document.documentElement.style;
  if (!primaryColor) {
    root.removeProperty("--brand-primary");
    root.removeProperty("--brand-primary-fg");
    return;
  }
  root.setProperty("--brand-primary", primaryColor);
  const luminance = relativeLuminance(primaryColor);
  root.setProperty("--brand-primary-fg", luminance !== null && luminance > 0.5 ? DARK_TEXT : LIGHT_TEXT);
}
