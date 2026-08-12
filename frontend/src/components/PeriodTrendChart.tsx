// SalesTrendChart.tsx'teki basit CSS bar-chart yapısının, gün yerine periyot etiketiyle (hafta/ay/yıl)
// çalışan genel hâli — Faz 3 "satış takibi" (PROCESS.md, 2026-08-11). Aynı .trend-* CSS sınıflarını
// paylaşır, ayrı bir grafik kütüphanesi eklenmedi.
interface PeriodPoint {
  period: string;
  value: number;
}

interface PeriodTrendChartProps {
  points: PeriodPoint[];
  formatValue: (value: number) => string;
}

export function PeriodTrendChart({ points, formatValue }: PeriodTrendChartProps) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const min = points.length > 0 ? Math.min(...points.map((p) => p.value)) : 0;

  return (
    <div className="trend-chart-wrap">
      <div className="trend-chart-body">
        <div className="trend-y-axis">
          <span>{formatValue(max)}</span>
          <span>{formatValue(min)}</span>
        </div>
        <div className="trend-chart">
          {points.map((p) => (
            <div className="trend-bar-col" key={p.period} title={`${p.period}: ${formatValue(p.value)}`}>
              <div className="trend-bar" style={{ height: `${(p.value / max) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      {points.length > 0 && (
        <div className="trend-x-axis">
          <span>{points[0].period}</span>
          <span>{points[points.length - 1].period}</span>
        </div>
      )}
    </div>
  );
}
