export interface TrajectoryFlowLayerDescriptor {
  gray: number;
  alpha: number;
  strokeWidth: number;
  startOffset: number;
}

export interface TrajectoryFlowDescriptor {
  concurrentTrainCount: number;
  cycleLength: number;
  dashLength: number;
  durationSeconds: number;
  layers: TrajectoryFlowLayerDescriptor[];
}

const MIN_VISIBLE_FLOW_LENGTH = 52;

export function createTrajectoryFlowDescriptor(
  screenArcLength: number
): TrajectoryFlowDescriptor | null {
  if (!Number.isFinite(screenArcLength) || screenArcLength < MIN_VISIBLE_FLOW_LENGTH) {
    return null;
  }

  const layerCount = selectFlowLayerCount(screenArcLength);
  const dashLength = clamp(screenArcLength * 0.0185, 9.6, 13.8);
  const spacing = clamp(dashLength * 0.72, 6.1, 8.6);
  const tailLength = dashLength + spacing * (layerCount - 1);
  const minimumTrainGap = clamp(dashLength * 1.25, 10.5, 16.0);
  const concurrentTrainCount = selectConcurrentTrainCount(
    screenArcLength,
    tailLength,
    minimumTrainGap
  );
  const cycleLength =
    concurrentTrainCount === 1
      ? screenArcLength + Math.max(screenArcLength * 0.16, tailLength * 0.55, 42)
      : screenArcLength / concurrentTrainCount;
  const durationSeconds = clamp(cycleLength / 236, 0.72, 2.3);
  const layers = Array.from({ length: layerCount }, (_, index) => {
    const progress = index / Math.max(layerCount - 1, 1);
    return {
      gray: Math.round(interpolate(244, 18, progress)),
      alpha: interpolate(0.08, 0.955, progress),
      strokeWidth: interpolate(2.6, 4.7, progress),
      startOffset: -spacing * index
    };
  });

  return {
    concurrentTrainCount,
    cycleLength,
    dashLength,
    durationSeconds,
    layers
  };
}

export function computePolylineLength(points: Array<{ x: number; y: number }>): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return total;
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function selectFlowLayerCount(screenArcLength: number): number {
  if (screenArcLength < 120) {
    return 4;
  }
  if (screenArcLength < 220) {
    return 5;
  }
  if (screenArcLength < 360) {
    return 6;
  }
  if (screenArcLength < 540) {
    return 7;
  }
  return 8;
}

function selectConcurrentTrainCount(
  screenArcLength: number,
  tailLength: number,
  minimumTrainGap: number
): number {
  let count = 1;
  if (screenArcLength >= 260) {
    count = 2;
  }
  if (screenArcLength >= 620) {
    count = 3;
  }

  while (count > 1 && screenArcLength / count < tailLength + minimumTrainGap) {
    count -= 1;
  }

  return count;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
