import { useEffect, useRef, useState } from "react";
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

export interface ZoneSize {
  width: number;
  height: number;
}

interface StorePlanCanvasProps {
  zones: CanvasZone[];
  positions: Record<number, ZonePosition>;
  onPositionsChange: (next: Record<number, ZonePosition>) => void;
  onDragEnd: (zoneId: number, x: number, y: number) => void;
  onResizeEnd: (zoneId: number, width: number, height: number) => void;
  overlayLines: OverlayLine[];
  onScoreChange: (score: number | null) => void;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;
const MIN_ZONE_SIZE = 20;

// Backend x/y/width/height alanları int (bkz. backend/app/schemas/layout_zone.py) — pointer
// event'lerden gelen clientX/clientY (ve türetilen piksel hesapları) tarayıcı zoom/DPI'a bağlı
// olarak kesirli olabilir, bu yüzden burada tam sayıya yuvarlanıyor (aksi halde backend 422
// "int_from_float" ile reddediyor).
function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(value, min), Math.max(min, max)));
}

// Zone editörü A seçeneği — çakışma testi. Kenarları temas eden (touching) dikdörtgenler
// çakışma sayılmaz, sadece gerçek örtüşme (strict inequality).
function rectsOverlap(a: ZoneRect, b: ZoneRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function hasCollision(candidate: ZoneRect, others: ZoneRect[]): boolean {
  return others.some((o) => o.id !== candidate.id && rectsOverlap(candidate, o));
}

// Mağaza planı canvas'ı — zone dikdörtgenlerini çizer; konum (x/y) sürüklenebilir, sağ-alt köşeden
// serbestçe boyutlandırılabilir (zone editörü A seçeneği). Her iki etkileşim de çakışma-farkında:
// hareket/resize sırasında serbest (çakışan zone kırmızı kenarlıkla işaretlenir), pointer bırakılınca
// hâlâ çakışıyorsa son geçerli konum/boyuta geri alınır (reject-on-drop) — geçerliyse parent'a
// bildirilir. Öneri çiftleri arasına bağlantı çizgisi çizer (SHOULD) ve yerleşim skorunu her
// pozisyon/boyut/öneri değişiminde parent'a bildirir (COULD).
// Kontrollü bileşen: pozisyon/boyut parent'ta tutulur (simülasyon modunda kaydetmeden değiştirilebilsin
// diye), bu bileşen sadece sürükleme/resize etkileşimini + çizimi yönetir.
// Bkz. docs/superpowers/specs/2026-08-07-layout-floorplan-should-could-design.md.
export function StorePlanCanvas({
  zones,
  positions,
  onPositionsChange,
  onDragEnd,
  onResizeEnd,
  overlayLines,
  onScoreChange,
}: StorePlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragZoneId = useRef<number | null>(null);
  const dragOffset = useRef<ZonePosition>({ x: 0, y: 0 });
  const lastValidPosition = useRef<ZonePosition | null>(null);

  const resizeZoneId = useRef<number | null>(null);
  const resizeOrigin = useRef<{ pointerX: number; pointerY: number; width: number; height: number }>({
    pointerX: 0,
    pointerY: 0,
    width: 0,
    height: 0,
  });
  const lastValidSize = useRef<ZoneSize | null>(null);

  const [collidingZoneId, setCollidingZoneId] = useState<number | null>(null);
  // Resize sürüklenirken kutunun kendisi + skor/overlay çizgileri canlı güncellensin diye —
  // parent'a sadece pointerUp'ta (geçerliyse) nihai boyut bildirilir, bkz. handlePointerUp.
  const [liveSize, setLiveSize] = useState<{ zoneId: number } & ZoneSize | null>(null);

  const rects: ZoneRect[] = zones.map((z) => {
    const pos = positions[z.id] ?? { x: 0, y: 0 };
    const size = liveSize && liveSize.zoneId === z.id ? liveSize : { width: z.width, height: z.height };
    return { id: z.id, x: pos.x, y: pos.y, width: size.width, height: size.height };
  });

  useEffect(() => {
    onScoreChange(computeLayoutScore(rects, overlayLines));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, zones, liveSize, overlayLines]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, zoneId: number) {
    const containerRect = containerRef.current?.getBoundingClientRect();
    const pos = positions[zoneId];
    if (!containerRect || !pos) return;
    dragZoneId.current = zoneId;
    lastValidPosition.current = pos;
    dragOffset.current = {
      x: e.clientX - containerRect.left - pos.x,
      y: e.clientY - containerRect.top - pos.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>, zoneId: number) {
    e.stopPropagation();
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    resizeZoneId.current = zoneId;
    lastValidSize.current = { width: zone.width, height: zone.height };
    resizeOrigin.current = { pointerX: e.clientX, pointerY: e.clientY, width: zone.width, height: zone.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragZoneId.current !== null) {
      const zoneId = dragZoneId.current;
      const containerRect = containerRef.current?.getBoundingClientRect();
      const zone = zones.find((z) => z.id === zoneId);
      if (!containerRect || !zone) return;
      const nextX = clamp(e.clientX - containerRect.left - dragOffset.current.x, 0, CANVAS_WIDTH - zone.width);
      const nextY = clamp(e.clientY - containerRect.top - dragOffset.current.y, 0, CANVAS_HEIGHT - zone.height);
      const candidate: ZoneRect = { id: zoneId, x: nextX, y: nextY, width: zone.width, height: zone.height };
      if (hasCollision(candidate, rects)) {
        setCollidingZoneId(zoneId);
      } else {
        setCollidingZoneId(null);
        lastValidPosition.current = { x: nextX, y: nextY };
      }
      onPositionsChange({ ...positions, [zoneId]: { x: nextX, y: nextY } });
      return;
    }
    if (resizeZoneId.current !== null) {
      const zoneId = resizeZoneId.current;
      const zone = zones.find((z) => z.id === zoneId);
      const pos = positions[zoneId];
      if (!zone || !pos) return;
      const origin = resizeOrigin.current;
      const nextWidth = clamp(
        origin.width + (e.clientX - origin.pointerX),
        MIN_ZONE_SIZE,
        CANVAS_WIDTH - pos.x,
      );
      const nextHeight = clamp(
        origin.height + (e.clientY - origin.pointerY),
        MIN_ZONE_SIZE,
        CANVAS_HEIGHT - pos.y,
      );
      const candidate: ZoneRect = { id: zoneId, x: pos.x, y: pos.y, width: nextWidth, height: nextHeight };
      // Çakışma testi hedef zone'un kendi (eski boyutlu) satırını hariç tutar (hasCollision id
      // eşleşmesiyle filtreliyor), bu yüzden `rects` içindeki liveSize-güncel kendi satırı sorun
      // yaratmaz.
      if (hasCollision(candidate, rects)) {
        setCollidingZoneId(zoneId);
      } else {
        setCollidingZoneId(null);
        lastValidSize.current = { width: nextWidth, height: nextHeight };
      }
      setLiveSize({ zoneId, width: nextWidth, height: nextHeight });
    }
  }

  function handlePointerUp() {
    if (dragZoneId.current !== null) {
      const zoneId = dragZoneId.current;
      dragZoneId.current = null;
      const wasColliding = collidingZoneId === zoneId;
      setCollidingZoneId(null);
      const finalPos = wasColliding ? lastValidPosition.current : positions[zoneId];
      if (finalPos) {
        if (wasColliding) onPositionsChange({ ...positions, [zoneId]: finalPos });
        onDragEnd(zoneId, finalPos.x, finalPos.y);
      }
      lastValidPosition.current = null;
      return;
    }
    if (resizeZoneId.current !== null) {
      const zoneId = resizeZoneId.current;
      resizeZoneId.current = null;
      const wasColliding = collidingZoneId === zoneId;
      setCollidingZoneId(null);
      const finalSize = wasColliding ? lastValidSize.current : liveSize && liveSize.zoneId === zoneId ? liveSize : null;
      setLiveSize(null);
      lastValidSize.current = null;
      if (finalSize) onResizeEnd(zoneId, finalSize.width, finalSize.height);
    }
  }

  function centerOf(zoneId: number): ZonePosition | null {
    const rect = rects.find((r) => r.id === zoneId);
    if (!rect) return null;
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
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
        const rect = rects.find((r) => r.id === zone.id);
        if (!rect) return null;
        return (
          <div
            key={zone.id}
            className={`zone-box${collidingZoneId === zone.id ? " colliding" : ""}`}
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
            onPointerDown={(e) => handlePointerDown(e, zone.id)}
          >
            {zone.name}
            <div className="zone-resize-handle" onPointerDown={(e) => handleResizePointerDown(e, zone.id)} />
          </div>
        );
      })}
    </div>
  );
}
