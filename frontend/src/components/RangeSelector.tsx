import { useTranslation } from "react-i18next";

interface RangeSelectorProps {
  value: 7 | 30 | 90;
  onChange: (days: 7 | 30 | 90) => void;
}

const OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];

// Üç yönetici panosunda (Şube Müdürü/Genel Müdür/Seller Manager) ortak — wireframe'de yoktu, satış
// raporu backend'i "seçilebilir aralık" olarak tasarlandığı için eklendi (kullanıcı kararı).
export function RangeSelector({ value, onChange }: RangeSelectorProps) {
  const { t } = useTranslation();
  return (
    <span className="filters">
      {OPTIONS.map((days) => (
        <button
          key={days}
          className={`btn sm${value === days ? " primary" : " ghost"}`}
          onClick={() => onChange(days)}
        >
          {t("rangeSelector.days", { count: days })}
        </button>
      ))}
    </span>
  );
}
