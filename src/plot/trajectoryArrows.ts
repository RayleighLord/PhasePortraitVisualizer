export interface PathArrowPlacement {
  x: number;
  y: number;
  angle: number;
}

export function computePathArrowPlacements(
  points: Array<{ x: number; y: number }>,
  options: {
    minVisibleLength?: number;
    maxCount?: number;
  } = {}
): PathArrowPlacement[] {
  if (points.length < 2) {
    return [];
  }

  const cumulative: number[] = [0];
  let totalLength = 0;

  for (let index = 1; index < points.length; index += 1) {
    totalLength += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    cumulative.push(totalLength);
  }

  const minVisibleLength = options.minVisibleLength ?? 90;
  if (totalLength < minVisibleLength) {
    return [];
  }

  const maxCount = options.maxCount ?? 4;
  const count = Math.min(selectArrowCount(totalLength), maxCount);
  const startLength = totalLength * 0.16;
  const endLength = totalLength * 0.84;
  const placements: PathArrowPlacement[] = [];

  for (let index = 1; index <= count; index += 1) {
    const progress = count === 1 ? 0.5 : (index - 1) / (count - 1);
    const target = startLength + (endLength - startLength) * progress;
    const point = samplePointAtLength(points, cumulative, target);
    const tangentPadding = Math.min(totalLength * 0.08, 48);
    const tangentStart = samplePointAtLength(points, cumulative, Math.max(target - tangentPadding, 0));
    const tangentEnd = samplePointAtLength(
      points,
      cumulative,
      Math.min(target + tangentPadding, totalLength)
    );
    const angle = Math.atan2(tangentEnd.y - tangentStart.y, tangentEnd.x - tangentStart.x);

    placements.push({ x: point.x, y: point.y, angle });
  }

  return placements;
}

function selectArrowCount(totalLength: number): number {
  if (totalLength < 180) {
    return 1;
  }

  if (totalLength < 340) {
    return 2;
  }

  if (totalLength < 520) {
    return 3;
  }

  return 4;
}

function samplePointAtLength(
  points: Array<{ x: number; y: number }>,
  cumulative: number[],
  target: number
): { x: number; y: number } {
  const segmentIndex = cumulative.findIndex((value) => value >= target);
  const boundedIndex = Math.max(segmentIndex, 1);
  const start = points[boundedIndex - 1];
  const end = points[boundedIndex];
  const previousLength = cumulative[boundedIndex - 1];
  const segmentLength = cumulative[boundedIndex] - previousLength || 1;
  const progress = (target - previousLength) / segmentLength;

  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress
  };
}
