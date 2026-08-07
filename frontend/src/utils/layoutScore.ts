export interface ZoneRect {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScorePair {
  score: number; // 0..1
  zoneAId: number | null;
  zoneBId: number | null;
}

interface Point {
  cx: number;
  cy: number;
}

function centerOf(zone: ZoneRect): Point {
  return { cx: zone.x + zone.width / 2, cy: zone.y + zone.height / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.cx - b.cx, a.cy - b.cy);
}

function boundingBoxDiagonal(zones: ZoneRect[]): number {
  if (zones.length === 0) return 0;
  const minX = Math.min(...zones.map((z) => z.x));
  const minY = Math.min(...zones.map((z) => z.y));
  const maxX = Math.max(...zones.map((z) => z.x + z.width));
  const maxY = Math.max(...zones.map((z) => z.y + z.height));
  return Math.hypot(maxX - minX, maxY - minY);
}

// Spec: docs/superpowers/specs/2026-08-07-layout-floorplan-should-could-design.md — COULD bölümü,
// "Yerleşim skoru formülü". Aynı zone'daki ya da zone'suz ürün içeren çiftler hesaba katılmaz.
// Hiçbir çift hesaplanamıyorsa null döner (çağıran taraf "zone'lara ürün atayın" notunu gösterir).
export function computeLayoutScore(zones: ZoneRect[], pairs: ScorePair[]): number | null {
  const byId = new Map(zones.map((z) => [z.id, z]));
  let weightedDistanceSum = 0;
  let weightSum = 0;

  for (const pair of pairs) {
    if (pair.zoneAId === null || pair.zoneBId === null || pair.zoneAId === pair.zoneBId) continue;
    const zoneA = byId.get(pair.zoneAId);
    const zoneB = byId.get(pair.zoneBId);
    if (!zoneA || !zoneB) continue;
    const d = distance(centerOf(zoneA), centerOf(zoneB));
    weightedDistanceSum += pair.score * d;
    weightSum += pair.score;
  }

  if (weightSum === 0) return null;

  const avgDistance = weightedDistanceSum / weightSum;
  const maxDistance = boundingBoxDiagonal(zones);
  if (maxDistance === 0) return 100;

  return Math.round(100 * Math.max(0, 1 - avgDistance / maxDistance));
}
