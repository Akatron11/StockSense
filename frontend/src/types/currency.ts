// backend/app/schemas/currency.py::CurrencyRatesOut ile birebir eşleşir (Faz 3 "döviz ekranı").
export interface CurrencyRatesOut {
  base: string;
  date: string | null;
  rates: Record<string, number>;
}
