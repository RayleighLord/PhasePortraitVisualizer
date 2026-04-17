import type { AxisBounds, StatePoint } from "../types";

export interface PlotSnapOptions {
  bounds: AxisBounds;
  scaleX: number;
  scaleY: number;
  axisSnapPixels?: number;
}

export function snapPointToAxes(
  point: StatePoint,
  options: PlotSnapOptions
): StatePoint {
  const axisSnapPixels = options.axisSnapPixels ?? 14;
  const xCandidates: number[] = [];
  const yCandidates: number[] = [];

  if (options.bounds.xMin <= 0 && options.bounds.xMax >= 0) {
    xCandidates.push(0);
  }

  if (options.bounds.yMin <= 0 && options.bounds.yMax >= 0) {
    yCandidates.push(0);
  }

  return {
    x: snapCoordinate(point.x, xCandidates, options.scaleX, axisSnapPixels),
    y: snapCoordinate(point.y, yCandidates, options.scaleY, axisSnapPixels)
  };
}

function snapCoordinate(
  value: number,
  candidates: number[],
  scale: number,
  snapPixels: number
): number {
  if (!Number.isFinite(scale) || scale <= 0 || candidates.length === 0) {
    return value;
  }

  const threshold = snapPixels / scale;
  let best = value;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = Math.abs(candidate - value);
    if (distance <= threshold && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}
