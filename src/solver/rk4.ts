import type {
  AxisBounds,
  CompiledSystem,
  SolverSettings,
  StatePoint,
  TerminationReason,
  Trajectory,
  TrajectorySeed
} from "../types";

interface TraceResult {
  points: StatePoint[];
  terminationReason: TerminationReason;
  arcLength: number;
}

export function createSolverSettings(bounds: AxisBounds): SolverSettings {
  const span = Math.min(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin);
  const maxAbs = Math.max(
    Math.abs(bounds.xMin),
    Math.abs(bounds.xMax),
    Math.abs(bounds.yMin),
    Math.abs(bounds.yMax)
  );

  return {
    minStepSize: 0.0025,
    maxStepSize: 0.08,
    maxSteps: 3500,
    blowUpThreshold: Math.max(maxAbs * 12, 24),
    targetSpatialStep: Math.max(span / 84, 0.03),
    maxArcLength: Math.max(span * 3.5, 14)
  };
}

export function solveTrajectory(
  seed: TrajectorySeed,
  bounds: AxisBounds,
  system: CompiledSystem,
  settings: SolverSettings
): Trajectory {
  const backward = traceDirection(seed, bounds, system, settings, -1);
  const forward = traceDirection(seed, bounds, system, settings, 1);
  const points = [...backward.points.reverse(), ...forward.points.slice(1)];

  return {
    id: seed.id,
    seed,
    points,
    terminationReason: selectTerminationReason(backward, forward),
    totalArcLength: backward.arcLength + forward.arcLength
  };
}

function traceDirection(
  seed: TrajectorySeed,
  bounds: AxisBounds,
  system: CompiledSystem,
  settings: SolverSettings,
  direction: -1 | 1
): TraceResult {
  const points: StatePoint[] = [{ x: seed.x, y: seed.y }];
  let current = { x: seed.x, y: seed.y };
  let steps = 0;
  let arcLength = 0;

  while (steps < settings.maxSteps) {
    const vector = system.evaluate(current.x, current.y);
    const speed = Math.hypot(vector.dx, vector.dy);

    if (!Number.isFinite(speed)) {
      return { points, terminationReason: "invalid-value", arcLength };
    }

    const stepSize = selectStepSize(speed, settings) * direction;

    try {
      const next = rk4Step(system, current, stepSize, vector);

      if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) {
        return { points, terminationReason: "invalid-value", arcLength };
      }

      if (
        Math.abs(next.x) > settings.blowUpThreshold ||
        Math.abs(next.y) > settings.blowUpThreshold
      ) {
        const clipped = clipSegmentToBounds(current, next, bounds);
        if (clipped) {
          arcLength += Math.hypot(clipped.x - current.x, clipped.y - current.y);
          points.push(clipped);
        }
        return { points, terminationReason: "escaped-plot", arcLength };
      }

      if (!isPointInsideBounds(next, bounds)) {
        const clipped = clipSegmentToBounds(current, next, bounds);
        if (clipped) {
          arcLength += Math.hypot(clipped.x - current.x, clipped.y - current.y);
          points.push(clipped);
        }
        return { points, terminationReason: "escaped-plot", arcLength };
      }

      const segmentLength = Math.hypot(next.x - current.x, next.y - current.y);
      arcLength += segmentLength;
      if (arcLength >= settings.maxArcLength) {
        points.push(next);
        return { points, terminationReason: "length-limit", arcLength };
      }

      points.push(next);
      current = next;
      steps += 1;
    } catch {
      return { points, terminationReason: "solver-error", arcLength };
    }
  }

  return { points, terminationReason: "max-steps", arcLength };
}

function selectStepSize(speed: number, settings: SolverSettings): number {
  const adaptive = settings.targetSpatialStep / Math.max(speed, 1e-4);
  return clamp(adaptive, settings.minStepSize, settings.maxStepSize);
}

function rk4Step(
  system: CompiledSystem,
  state: StatePoint,
  stepSize: number,
  initialVector: { dx: number; dy: number }
): StatePoint {
  const k1 = initialVector;
  const k2 = system.evaluate(
    state.x + (stepSize * k1.dx) / 2,
    state.y + (stepSize * k1.dy) / 2
  );
  const k3 = system.evaluate(
    state.x + (stepSize * k2.dx) / 2,
    state.y + (stepSize * k2.dy) / 2
  );
  const k4 = system.evaluate(
    state.x + stepSize * k3.dx,
    state.y + stepSize * k3.dy
  );

  if (
    !Number.isFinite(k1.dx) ||
    !Number.isFinite(k1.dy) ||
    !Number.isFinite(k2.dx) ||
    !Number.isFinite(k2.dy) ||
    !Number.isFinite(k3.dx) ||
    !Number.isFinite(k3.dy) ||
    !Number.isFinite(k4.dx) ||
    !Number.isFinite(k4.dy)
  ) {
    throw new Error("Encountered a non-finite vector field evaluation.");
  }

  return {
    x: state.x + (stepSize / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
    y: state.y + (stepSize / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy)
  };
}

function clipSegmentToBounds(
  start: StatePoint,
  end: StatePoint,
  bounds: AxisBounds
): StatePoint | null {
  const candidates: number[] = [];
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;

  if (Math.abs(deltaX) > 1e-12) {
    for (const xBoundary of [bounds.xMin, bounds.xMax]) {
      const t = (xBoundary - start.x) / deltaX;
      if (t >= 0 && t <= 1) {
        const y = start.y + t * deltaY;
        if (y >= bounds.yMin - 1e-9 && y <= bounds.yMax + 1e-9) {
          candidates.push(t);
        }
      }
    }
  }

  if (Math.abs(deltaY) > 1e-12) {
    for (const yBoundary of [bounds.yMin, bounds.yMax]) {
      const t = (yBoundary - start.y) / deltaY;
      if (t >= 0 && t <= 1) {
        const x = start.x + t * deltaX;
        if (x >= bounds.xMin - 1e-9 && x <= bounds.xMax + 1e-9) {
          candidates.push(t);
        }
      }
    }
  }

  const positiveCandidates = candidates.filter((value) => value > 1e-9);
  if (positiveCandidates.length === 0) {
    return null;
  }

  const intersection = Math.min(...positiveCandidates);
  return {
    x: start.x + deltaX * intersection,
    y: start.y + deltaY * intersection
  };
}

function isPointInsideBounds(point: StatePoint, bounds: AxisBounds): boolean {
  return (
    point.x >= bounds.xMin &&
    point.x <= bounds.xMax &&
    point.y >= bounds.yMin &&
    point.y <= bounds.yMax
  );
}

function selectTerminationReason(
  backward: TraceResult,
  forward: TraceResult
): TerminationReason {
  const candidates = [forward.terminationReason, backward.terminationReason];
  return candidates.find((reason) => reason !== "max-steps") ?? "max-steps";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
