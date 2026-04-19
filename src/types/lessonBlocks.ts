export interface LayeredDropZone {
  id: string;
  label: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  accepts?: string[];
  acceptsGroups?: string[];
  silhouetteImageUrl?: string;
  audioUrl?: string;
  hideFromStudent?: boolean;
  zIndex?: number;
  clipPathPolygon?: string;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  quadPoints?: [number, number, number, number, number, number, number, number];
  itemScale?: number;
  itemOffsetX?: number;
  itemOffsetY?: number;
}

export interface LayeredDragItem {
  id: string;
  label: string;
  imageUrl: string;
  targetZoneId: string;
  group?: string;
  audioUrl?: string;
  successAudioUrl?: string;
  xPct?: number;
  yPct?: number;
  widthPct?: number;
  zIndex?: number;
}
