// 100% zoom displays 12 screen pixels per world meter.
export const BASE_SCALE = 12;
export const MIN_SCALE = 0.15;
export const MAX_SCALE = BASE_SCALE * 24;
export const GRID_SPACING = 10;
export const zoomPercent = (scale: number): number =>
  Math.round((scale / BASE_SCALE) * 100);
