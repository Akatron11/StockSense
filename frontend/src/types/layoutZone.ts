// backend/app/schemas/layout_zone.py ile birebir eşleşir.
export interface LayoutZoneProduct {
  id: number;
  name: string;
}

export interface LayoutZoneOut {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  products: LayoutZoneProduct[];
}

export interface LayoutZoneCreatePayload {
  name: string;
  width: number;
  height: number;
}

export interface LayoutZoneUpdatePayload {
  name?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}
