import type { SalesTrendPoint } from "../types/report";

interface SalesTrendChartProps {
  trend: SalesTrendPoint[];
}

// "chartbox" wireframe yer tutucusunun yerini alan basit CSS bar-chart — gerçek trend verisi geldiği için
// dashed placeholder yerine kullanılıyor, ayrı bir grafik kütüphanesi eklenmedi.
export function SalesTrendChart({ trend }: SalesTrendChartProps) {
  const max = Math.max(1, ...trend.map((p) => p.total_sales));

  return (
    <div className="trend-chart">
      {trend.map((point) => (
        <div className="trend-bar-col" key={point.day} title={`${point.day}: ${point.total_sales.toFixed(2)}`}>
          <div className="trend-bar" style={{ height: `${(point.total_sales / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}
