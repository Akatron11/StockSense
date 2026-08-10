// backend/app/schemas/stock_zone.py ile birebir eşleşir.
export interface StockZoneOut {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StockZoneCreatePayload {
  name: string;
  width: number;
  height: number;
}

export interface StockZoneUpdatePayload {
  name?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}
