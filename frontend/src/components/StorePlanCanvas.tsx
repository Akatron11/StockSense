import { useEffect, useRef } from "react";
import { computeLayoutScore, type ScorePair, type ZoneRect } from "../utils/layoutScore";

export interface CanvasZone {
  id: number;
  name: string;
  width: number;
  height: number;
}

export interface OverlayLine extends ScorePair {
  key: string;
  productAName: string;
  productBName: string;
}

export interface ZonePosition {
  x: number;
  y: number;
}

interface StorePlanCanvasProps {
  zones: CanvasZone[];
  positions: Record<number, ZonePosition>;
  onPositionsChange: (next: Record<number, ZonePosition>) => void;
  onDragEnd: (zoneId: number, x: number, y: number) => void;
  overlayLines: OverlayLine[];
  onScoreChange: (score: number | null) => void;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// Mağaza planı canvas'ı — zone dikdörtgenlerini çizer, sadece konum (x/y) sürüklenebilir
// (boyut sabit — zone editörü B seçeneği). Öneri çiftleri arasına bağlantı çizgisi çizer (SHOULD)
// ve yerleşim skorunu her pozisyon/öneri değişiminde parent'a bildirir (COULD).
// Kontrollü bileşen: pozisyonlar parent'ta tutulur (simülasyon modunda kaydetmeden değiştirilebilsin
// diye), bu bileşen sadece sürükleme etkileşimini + çizimi yönetir.
// Bkz. docs/superpowers/specs/2026-08-07-layout-floorplan-should-could-design.md.
export function StorePlanCanvas({
  zones,
  positions,
  onPositionsChange,
  onDragEnd,
  overlayLines,
  onScoreChange,
}: StorePlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragZoneId = useRef<number | null>(null);
  const dragOffset = useRef<ZonePosition>({ x: 0, y: 0 });

  const rects: ZoneRect[] = zones.map((z) => {
    const pos = positions[z.id] ?? { x: 0, y: 0 };
    return { id: z.id, x: pos.x, y: pos.y, width: z.width, height: z.height };
  });

  useEffect(() => {
    onScoreChange(computeLayoutScore(rects, overlayLines));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, overlayLines]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, zoneId: number) {
    const containerRect = containerRef.current?.getBoundingClientRect();
    const pos = positions[zoneId];
    if (!containerRect || !pos) return;
    dragZoneId.current = zoneId;
    dragOffset.current = {
      x: e.clientX - containerRect.left - pos.x,
      y: e.clientY - containerRect.top - pos.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const zoneId = dragZoneId.current;
    const containerRect = containerRef.current?.getBoundingClientRect();
    const zone = zones.find((z) => z.id === zoneId);
    if (zoneId === null || !containerRect || !zone) return;
    const nextX = clamp(e.clientX - containerRect.left - dragOffset.current.x, 0, CANVAS_WIDTH - zone.width);
    const nextY = clamp(e.clientY - containerRect.top - dragOffset.current.y, 0, CANVAS_HEIGHT - zone.height);
    onPositionsChange({ ...positions, [zoneId]: { x: nextX, y: nextY } });
  }

  function handlePointerUp() {
    const zoneId = dragZoneId.current;
    dragZoneId.current = null;
    if (zoneId === null) return;
    const pos = positions[zoneId];
    if (pos) onDragEnd(zoneId, pos.x, pos.y);
  }

  function centerOf(zoneId: number): ZonePosition | null {
    const zone = zones.find((z) => z.id === zoneId);
    const pos = positions[zoneId];
    if (!zone || !pos) return null;
    return { x: pos.x + zone.width / 2, y: pos.y + zone.height / 2 };
  }

  return (
    <div
      ref={containerRef}
      className="zone-canvas"
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <svg className="zone-canvas-overlay" width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        {overlayLines.map((line) => {
          const a = line.zoneAId !== null ? centerOf(line.zoneAId) : null;
          const b = line.zoneBId !== null ? centerOf(line.zoneBId) : null;
          if (!a || !b || line.zoneAId === line.zoneBId) return null;
          return (
            <g key={line.key}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c0392b" strokeWidth={2} strokeDasharray="4" />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} fill="#c0392b" fontSize={11}>
                {Math.round(line.score * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
      {zones.map((zone) => {
        const pos = positions[zone.id] ?? { x: 0, y: 0 };
        return (
          <div
            key={zone.id}
            className="zone-box"
            style={{ left: pos.x, top: pos.y, width: zone.width, height: zone.height }}
            onPointerDown={(e) => handlePointerDown(e, zone.id)}
          >
            {zone.name}
          </div>
        );
      })}
    </div>
  );
}
