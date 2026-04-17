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

const MIN_VISIBLE_FLOW_LENGTH = 44;
const FLOW_LAYER_COUNT = 26;

export function createTrajectoryFlowDescriptor(
  screenArcLength: number
): TrajectoryFlowDescriptor | null {
  if (!Number.isFinite(screenArcLength) || screenArcLength < MIN_VISIBLE_FLOW_LENGTH) {
    return null;
  }

  const dashLength = clamp(screenArcLength * 0.019, 8.6, 12.8);
  const spacing = clamp(dashLength * 0.56, 4.8, 6.8);
  const tailLength = dashLength + spacing * (FLOW_LAYER_COUNT - 1);
  const minimumTrainGap = clamp(dashLength * 1.05, 8.5, 12.5);
  const concurrentTrainCount = selectConcurrentTrainCount(
    screenArcLength,
    tailLength,
    minimumTrainGap
  );
  const cycleLength =
    concurrentTrainCount === 1
      ? screenArcLength + Math.max(screenArcLength * 0.24, tailLength * 0.42, 38)
      : screenArcLength / concurrentTrainCount;
  const durationSeconds = clamp(cycleLength / 235, 0.62, 2.35);
  const layers = Array.from({ length: FLOW_LAYER_COUNT }, (_, index) => {
    const progress = index / Math.max(FLOW_LAYER_COUNT - 1, 1);
    return {
      gray: Math.round(interpolate(246, 10, progress)),
      alpha: interpolate(0.05, 0.985, progress),
      strokeWidth: interpolate(2.65, 4.95, progress),
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

function selectConcurrentTrainCount(
  screenArcLength: number,
  tailLength: number,
  minimumTrainGap: number
): number {
  let count = 1;

  if (screenArcLength >= 170) {
    count = 2;
  }

  if (screenArcLength >= 320) {
    count = 3;
  }

  if (screenArcLength >= 510) {
    count = 4;
  }

  if (screenArcLength >= 760) {
    count = 5;
  }

  while (count > 1 && screenArcLength / count < tailLength + minimumTrainGap) {
    count -= 1;
  }

  return count;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
