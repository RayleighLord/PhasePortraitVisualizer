import type {
  AxisBounds,
  CompiledSystem,
  ComplexValue,
  EquilibriumCandidate,
  EquilibriumPointAnalysis,
  JacobianMatrix,
  PhasePortraitAnalysis,
  StatePoint
} from "../types";

interface EquilibriumSearchOptions {
  gridSize?: number;
  tolerance?: number;
  maxIterations?: number;
  dedupeTolerance?: number;
}

export function analyzeSystem(
  system: CompiledSystem,
  bounds: AxisBounds,
  options: EquilibriumSearchOptions = {}
): PhasePortraitAnalysis {
  const equilibria = findEquilibria(system, bounds, options);

  if (equilibria.length === 0) {
    return {
      availability: "unavailable",
      equilibrium: null,
      equilibria: [],
      jacobian: null,
      trace: null,
      determinant: null,
      discriminant: null,
      eigenvalues: [],
      classification: "Unavailable",
      stability: "Unavailable",
      message: "No stationary point was detected inside the visible window."
    };
  }

  const equilibriumAnalyses = equilibria.map((equilibrium) =>
    analyzeEquilibrium(system, equilibrium, bounds)
  );
  const selected = selectRepresentativeEquilibrium(equilibriumAnalyses);

  if (!selected.jacobian) {
    return {
      availability: "unavailable",
      equilibrium: selected.equilibrium,
      equilibria: equilibriumAnalyses,
      jacobian: null,
      trace: null,
      determinant: null,
      discriminant: null,
      eigenvalues: [],
      classification: "Unavailable",
      stability: "Unavailable",
      message: "The local linearization could not be computed near the detected equilibrium."
    };
  }

  return {
    availability: "available",
    equilibrium: selected.equilibrium,
    equilibria: equilibriumAnalyses,
    jacobian: selected.jacobian,
    trace: selected.trace,
    determinant: selected.determinant,
    discriminant: selected.discriminant,
    eigenvalues: selected.eigenvalues,
    classification: selected.classification,
    stability: selected.stability,
    message: "Classification obtained from the Jacobian at the selected equilibrium."
  };
}

export function findEquilibria(
  system: CompiledSystem,
  bounds: AxisBounds,
  options: EquilibriumSearchOptions = {}
): EquilibriumCandidate[] {
  const gridSize = options.gridSize ?? 7;
  const tolerance = options.tolerance ?? 1e-8;
  const maxIterations = options.maxIterations ?? 20;
  const dedupeTolerance =
    options.dedupeTolerance ??
    Math.max(Math.min(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin) * 0.015, 1e-3);

  const roots: EquilibriumCandidate[] = [];
  const xStep = (bounds.xMax - bounds.xMin) / Math.max(gridSize - 1, 1);
  const yStep = (bounds.yMax - bounds.yMin) / Math.max(gridSize - 1, 1);

  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const start = {
        x: bounds.xMin + column * xStep,
        y: bounds.yMin + row * yStep
      };

      const candidate = refineEquilibrium(system, bounds, start, tolerance, maxIterations);
      if (!candidate) {
        continue;
      }

      if (!isPointInsideBounds(candidate, bounds)) {
        continue;
      }

      if (
        roots.some((root) => distanceBetween(root, candidate) <= dedupeTolerance)
      ) {
        continue;
      }

      roots.push(candidate);
    }
  }

  return roots.sort((left, right) => distanceToOrigin(left) - distanceToOrigin(right));
}

export function computeJacobian(
  system: CompiledSystem,
  point: StatePoint,
  bounds: AxisBounds
): JacobianMatrix | null {
  const spanX = bounds.xMax - bounds.xMin;
  const spanY = bounds.yMax - bounds.yMin;
  const stepX = Math.max(Math.abs(point.x) * 1e-4, spanX * 1e-4, 1e-5);
  const stepY = Math.max(Math.abs(point.y) * 1e-4, spanY * 1e-4, 1e-5);

  const left = system.evaluate(point.x - stepX, point.y);
  const right = system.evaluate(point.x + stepX, point.y);
  const down = system.evaluate(point.x, point.y - stepY);
  const up = system.evaluate(point.x, point.y + stepY);

  const entries = [
    left.dx,
    right.dx,
    down.dx,
    up.dx,
    left.dy,
    right.dy,
    down.dy,
    up.dy
  ];

  if (!entries.every(Number.isFinite)) {
    return null;
  }

  return {
    xx: (right.dx - left.dx) / (2 * stepX),
    xy: (up.dx - down.dx) / (2 * stepY),
    yx: (right.dy - left.dy) / (2 * stepX),
    yy: (up.dy - down.dy) / (2 * stepY)
  };
}

function analyzeEquilibrium(
  system: CompiledSystem,
  equilibrium: EquilibriumCandidate,
  bounds: AxisBounds
): EquilibriumPointAnalysis {
  const jacobian = computeJacobian(system, equilibrium, bounds);

  if (!jacobian) {
    return {
      equilibrium,
      jacobian: null,
      trace: null,
      determinant: null,
      discriminant: null,
      eigenvalues: [],
      classification: "Unavailable",
      stability: "Unavailable",
      message: "The local linearization could not be computed near this equilibrium."
    };
  }

  const trace = jacobian.xx + jacobian.yy;
  const determinant = jacobian.xx * jacobian.yy - jacobian.xy * jacobian.yx;
  const discriminant = trace * trace - 4 * determinant;
  const eigenvalues = computeEigenvalues(trace, discriminant);
  const classification = classifyPortrait(trace, determinant, discriminant);

  return {
    equilibrium,
    jacobian,
    trace,
    determinant,
    discriminant,
    eigenvalues,
    classification,
    stability: describeStability(trace, determinant, discriminant),
    message: "Classification obtained from the Jacobian at this equilibrium."
  };
}

function refineEquilibrium(
  system: CompiledSystem,
  bounds: AxisBounds,
  start: StatePoint,
  tolerance: number,
  maxIterations: number
): EquilibriumCandidate | null {
  let current = { ...start };

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const value = system.evaluate(current.x, current.y);
    const residual = Math.hypot(value.dx, value.dy);

    if (!Number.isFinite(residual)) {
      return null;
    }

    if (residual <= tolerance) {
      return {
        ...current,
        residual
      };
    }

    const jacobian = computeJacobian(system, current, bounds);
    if (!jacobian) {
      return null;
    }

    const delta = solveLinearStep(jacobian, value.dx, value.dy);
    if (!delta) {
      return null;
    }

    current = {
      x: current.x + delta.x,
      y: current.y + delta.y
    };

    if (!Number.isFinite(current.x) || !Number.isFinite(current.y)) {
      return null;
    }

    if (Math.hypot(delta.x, delta.y) <= tolerance * 0.5) {
      const refined = system.evaluate(current.x, current.y);
      const refinedResidual = Math.hypot(refined.dx, refined.dy);
      if (Number.isFinite(refinedResidual) && refinedResidual <= tolerance * 25) {
        return {
          ...current,
          residual: refinedResidual
        };
      }
    }
  }

  const terminalValue = system.evaluate(current.x, current.y);
  const terminalResidual = Math.hypot(terminalValue.dx, terminalValue.dy);

  if (Number.isFinite(terminalResidual) && terminalResidual <= tolerance * 25) {
    return {
      ...current,
      residual: terminalResidual
    };
  }

  return null;
}

function solveLinearStep(
  jacobian: JacobianMatrix,
  dx: number,
  dy: number
): StatePoint | null {
  const determinant = jacobian.xx * jacobian.yy - jacobian.xy * jacobian.yx;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-10) {
    return null;
  }

  return {
    x: (-dx * jacobian.yy + jacobian.xy * dy) / determinant,
    y: (jacobian.yx * dx - jacobian.xx * dy) / determinant
  };
}

function computeEigenvalues(trace: number, discriminant: number): ComplexValue[] {
  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant);
    return [
      { real: (trace - root) / 2, imaginary: 0 },
      { real: (trace + root) / 2, imaginary: 0 }
    ];
  }

  const imaginary = Math.sqrt(-discriminant) / 2;
  return [
    { real: trace / 2, imaginary: -imaginary },
    { real: trace / 2, imaginary },
  ];
}

function classifyPortrait(trace: number, determinant: number, discriminant: number): string {
  const tolerance = 1e-7;

  if (determinant < -tolerance) {
    return "Saddle";
  }

  if (Math.abs(determinant) <= tolerance) {
    return "Degenerate / inconclusive";
  }

  if (discriminant > tolerance) {
    if (trace < -tolerance) {
      return "Stable node";
    }

    if (trace > tolerance) {
      return "Unstable node";
    }

    return "Degenerate real-spectrum equilibrium";
  }

  if (discriminant < -tolerance) {
    if (Math.abs(trace) <= tolerance) {
      return "Center";
    }

    if (trace < 0) {
      return "Stable spiral";
    }

    return "Unstable spiral";
  }

  if (trace < -tolerance) {
    return "Stable repeated-eigenvalue node";
  }

  if (trace > tolerance) {
    return "Unstable repeated-eigenvalue node";
  }

  return "Degenerate / repeated-eigenvalue equilibrium";
}

function describeStability(trace: number, determinant: number, discriminant: number): string {
  const tolerance = 1e-7;

  if (determinant < -tolerance) {
    return "Unstable";
  }

  if (Math.abs(determinant) <= tolerance) {
    return "Degenerate";
  }

  if (discriminant < -tolerance && Math.abs(trace) <= tolerance) {
    return "Neutral";
  }

  if (trace < -tolerance) {
    return "Stable";
  }

  if (trace > tolerance) {
    return "Unstable";
  }

  return "Degenerate";
}

function selectRepresentativeEquilibrium(
  candidates: EquilibriumPointAnalysis[]
): EquilibriumPointAnalysis {
  return candidates.reduce((best, candidate) =>
    distanceToOrigin(candidate.equilibrium) < distanceToOrigin(best.equilibrium) ? candidate : best
  );
}

function isPointInsideBounds(point: StatePoint, bounds: AxisBounds): boolean {
  return (
    point.x >= bounds.xMin &&
    point.x <= bounds.xMax &&
    point.y >= bounds.yMin &&
    point.y <= bounds.yMax
  );
}

function distanceToOrigin(point: StatePoint): number {
  return Math.hypot(point.x, point.y);
}

function distanceBetween(left: StatePoint, right: StatePoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
