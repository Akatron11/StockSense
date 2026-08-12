import { useTranslation } from "react-i18next";
import type { SalesTrendPoint } from "../types/report";
import { formatCurrency } from "../utils/currency";

interface SalesTrendChartProps {
  trend: SalesTrendPoint[];
}

function shortDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

// "chartbox" wireframe yer tutucusunun yerini alan basit CSS bar-chart — gerçek trend verisi geldiği için
// dashed placeholder yerine kullanılıyor, ayrı bir grafik kütüphanesi eklenmedi.
// Eksen bilgisi (PROCESS.md, Faz 2): Y ekseni min/max değer + X ekseni ilk/son tarih — tam gridline'lı bir
// grafik kütüphanesine geçmeden, mevcut CSS bar-chart yapısına eklenen minimal bir okunabilirlik katmanı.
export function SalesTrendChart({ trend }: SalesTrendChartProps) {
  const { i18n } = useTranslation();
  const max = Math.max(1, ...trend.map((p) => p.total_sales));
  const min = trend.length > 0 ? Math.min(...trend.map((p) => p.total_sales)) : 0;

  return (
    <div className="trend-chart-wrap">
      <div className="trend-chart-body">
        <div className="trend-y-axis">
          <span>{formatCurrency(max)}</span>
          <span>{formatCurrency(min)}</span>
        </div>
        <div className="trend-chart">
          {trend.map((point) => (
            <div className="trend-bar-col" key={point.day} title={`${point.day}: ${formatCurrency(point.total_sales)}`}>
              <div className="trend-bar" style={{ height: `${(point.total_sales / max) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      {trend.length > 0 && (
        <div className="trend-x-axis">
          <span>{shortDate(trend[0].day, i18n.language)}</span>
          <span>{shortDate(trend[trend.length - 1].day, i18n.language)}</span>
        </div>
      )}
    </div>
  );
}
