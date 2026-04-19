import React, { useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Volume2, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import type { LayeredDragItem, LayeredDropZone } from '../types/lessonBlocks';
import { getMatrix3d } from '../lib/perspective';

interface LayeredDragDropExerciseProps {
  items: LayeredDragItem[];
  zones: LayeredDropZone[];
  backgroundImageUrl?: string;
  backgroundAudioUrl?: string;
  aspectRatio?: number;
  dropTolerancePct?: number;
  disabled?: boolean;
  value?: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}

const playAudio = (url?: string) => {
  if (!url) return;
  const audio = new Audio(url);
  void audio.play();
};

export const LayeredDragDropExercise: React.FC<LayeredDragDropExerciseProps> = ({
  items,
  zones,
  backgroundImageUrl,
  backgroundAudioUrl,
  aspectRatio = 16 / 9,
  dropTolerancePct = 4,
  disabled = false,
  value,
  onChange,
}) => {
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const placements = value ?? {};

  const placedItemIds = useMemo(
    () => new Set(Object.keys(placements).filter((itemId) => Boolean(placements[itemId]))),
    [placements]
  );

  const availableItems = useMemo(() => (items || []).filter((item) => !placedItemIds.has(item.id)), [items, placedItemIds]);

  const placeItem = (itemId: string, zoneId: string) => {
    const item = (items || []).find((entry) => entry.id === itemId);
    const zone = (zones || []).find((entry) => entry.id === zoneId);
    if (!item || !zone) return;
    if (Array.isArray(zone.accepts) && zone.accepts.length > 0 && !zone.accepts.includes(itemId)) return;
    if (Array.isArray(zone.acceptsGroups) && zone.acceptsGroups.length > 0) {
      if (!item.group || !zone.acceptsGroups.includes(item.group)) return;
    }

    onChange({ ...placements, [itemId]: zoneId });

    if (zone.audioUrl) playAudio(zone.audioUrl);
    if (item.successAudioUrl) playAudio(item.successAudioUrl);
  };

  const resetItem = (itemId: string) => {
    const next = { ...placements };
    delete next[itemId];
    onChange(next);
  };

  const resetAll = () => onChange({});

  const findDropZoneFromPointer = (clientX: number, clientY: number, itemId: string): LayeredDropZone | null => {
    const canvas = canvasRef.current;
    const item = items.find((entry) => entry.id === itemId);
    if (!canvas || !item) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const xPct = ((clientX - rect.left) / rect.width) * 100;
    const yPct = ((clientY - rect.top) / rect.height) * 100;
    const tolerance = Math.max(0, dropTolerancePct);

    return zones.find((zone) => {
      const acceptedById = !zone.accepts || zone.accepts.length === 0 || zone.accepts.includes(itemId);
      const acceptedByGroup =
        !zone.acceptsGroups || zone.acceptsGroups.length === 0 || (item.group && zone.acceptsGroups.includes(item.group));
      if (!acceptedById || !acceptedByGroup) return false;
      return (
        xPct >= zone.xPct - tolerance &&
        xPct <= zone.xPct + zone.widthPct + tolerance &&
        yPct >= zone.yPct - tolerance &&
        yPct <= zone.yPct + zone.heightPct + tolerance
      );
    }) ?? null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, itemId: string) => {
    if (disabled) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingItemId(itemId);
    draggingIdRef.current = itemId;
    setPointerPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>, itemId: string) => {
    if (draggingIdRef.current !== itemId) return;
    setPointerPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>, itemId: string) => {
    if (draggingIdRef.current !== itemId) return;
    const zone = findDropZoneFromPointer(e.clientX, e.clientY, itemId);
    if (zone) placeItem(itemId, zone.id);
    setDraggingItemId(null);
    draggingIdRef.current = null;
    setPointerPos(null);
  };

  const handlePointerCancel = () => {
    setDraggingItemId(null);
    draggingIdRef.current = null;
    setPointerPos(null);
  };

  const draggingItem = draggingItemId ? items.find((i) => i.id === draggingItemId) : null;

  return (
    <div className="space-y-4 w-full">
      {/* Ghost image that follows the pointer during drag */}
      {draggingItem && pointerPos && (
        <div
          className="fixed pointer-events-none z-[9999] w-20 h-20 opacity-80 rounded-lg overflow-hidden -translate-x-1/2 -translate-y-1/2"
          style={{ left: pointerPos.x, top: pointerPos.y }}
        >
          <img src={draggingItem.imageUrl} alt={draggingItem.label} className="w-full h-full object-contain drop-shadow-lg" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Arrastra y suelta las imágenes en el área correcta</Badge>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={resetAll}
          disabled={disabled}
          className="inline-flex items-center gap-1"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reiniciar
        </Button>
        {backgroundAudioUrl && (
          <Button type="button" size="sm" variant="outline" onClick={() => playAudio(backgroundAudioUrl)}>
            <Volume2 className="h-3.5 w-3.5 mr-1" />
            Escuchar audio
          </Button>
        )}
      </div>

      <div
        ref={canvasRef}
        className="relative w-full overflow-hidden rounded-xl border bg-slate-50"
        style={{ aspectRatio }}
      >
        {backgroundImageUrl ? (
          <img
            src={backgroundImageUrl}
            alt="Exercise background"
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" />
        )}

        {(zones || []).map((zone) => {
          const zoneItems = (items || []).filter((item) => placements[item.id] === zone.id);
          const hasPolygon = !!zone.clipPathPolygon;
          const zoneStyle: React.CSSProperties = {
            left: `${zone.xPct}%`,
            top: `${zone.yPct}%`,
            width: `${zone.widthPct}%`,
            height: `${zone.heightPct}%`,
            zIndex: zone.zIndex ?? 10,
            transform: `perspective(1000px) rotateX(${zone.rotateX || 0}deg) rotateY(${zone.rotateY || 0}deg) rotateZ(${zone.rotateZ || 0}deg)`,
            transformOrigin: 'center center',
            ...(zone.quadPoints ? { 
              clipPath: `polygon(${zone.quadPoints[0]}% ${zone.quadPoints[1]}%, ${zone.quadPoints[2]}% ${zone.quadPoints[3]}%, ${zone.quadPoints[4]}% ${zone.quadPoints[5]}%, ${zone.quadPoints[6]}% ${zone.quadPoints[7]}%)` 
            } : (hasPolygon ? { clipPath: `polygon(${zone.clipPathPolygon})` } : {})),
          };
          return (
            <div
              key={zone.id}
              className={cn('absolute p-1 border border-dashed border-gray-400', hasPolygon ? '' : 'rounded-lg')}
              style={zoneStyle}
            >
              {/* Silhouette hint — hidden when student has placed an item here */}
              {zone.silhouetteImageUrl && !zone.hideFromStudent && zoneItems.length === 0 && (
                <img
                  src={zone.silhouetteImageUrl}
                  alt={`${zone.label} silhouette`}
                  className="h-full w-full object-contain opacity-35"
                  draggable={false}
                  style={{ 
                    transform: `${zone.quadPoints ? getMatrix3d(zone.quadPoints) : 'none'} translate(${zone.itemOffsetX || 0}%, ${zone.itemOffsetY || 0}%) scale(${zone.itemScale || 1})`,
                    transformOrigin: '0 0'
                  }}
                />
              )}

              {zoneItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="absolute p-0.5 w-full h-full left-0 top-0"
                  style={{
                    zIndex: item.zIndex ?? 20,
                    transform: `${zone.quadPoints ? getMatrix3d(zone.quadPoints) : 'none'} translate(${zone.itemOffsetX || 0}%, ${zone.itemOffsetY || 0}%) scale(${zone.itemScale || 1})`,
                    transformOrigin: '0 0'
                  }}
                  onClick={() => !disabled && resetItem(item.id)}
                  title={`${item.label} · touched to revert`}
                >
                  <img src={item.imageUrl} alt={item.label} className="w-full h-full object-fill" />
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Items tray */}
      <div className="rounded-xl border bg-white p-3">
        <p className="mb-2 text-sm font-medium">Objetos para arrastrar</p>
        {availableItems.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">✅ Todos los objetos están colocados en el canvas.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {availableItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'group relative overflow-hidden rounded-lg border-2 bg-white p-2 shadow-sm transition select-none',
                  disabled ? 'cursor-default opacity-60' : 'cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-500/50',
                  draggingItemId === item.id && 'opacity-50 border-blue-500'
                )}
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => handlePointerDown(e, item.id)}
                onPointerMove={(e) => handlePointerMove(e, item.id)}
                onPointerUp={(e) => handlePointerUp(e, item.id)}
                onPointerCancel={handlePointerCancel}
              >
                <img
                  src={item.imageUrl}
                  alt={item.label}
                  className="mx-auto h-24 w-full object-contain pointer-events-none"
                  draggable={false}
                />
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-medium">{item.label}</span>
                  {item.audioUrl && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        playAudio(item.audioUrl);
                      }}
                      className="text-gray-400 hover:text-gray-900 shrink-0"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LayeredDragDropExercise;
