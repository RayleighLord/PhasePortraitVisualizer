export interface AxisBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface StatePoint {
  x: number;
  y: number;
}

export interface TrajectorySeed extends StatePoint {
  id: string;
}

export interface PlotPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlotLayout {
  width: number;
  height: number;
  padding: PlotPadding;
}

export interface AppState {
  xExpression: string;
  yExpression: string;
  bounds: AxisBounds;
  curveSeeds: TrajectorySeed[];
  selectedEquilibriumIndex: number | null;
  showTrajectoryAnimation: boolean;
  fieldDensity: number;
  boundsError: string | null;
}

export interface SolverSettings {
  minStepSize: number;
  maxStepSize: number;
  maxSteps: number;
  blowUpThreshold: number;
  targetSpatialStep: number;
  maxArcLength: number;
  convergenceSpeedThreshold: number;
  convergenceStepStreak: number;
}

export type TerminationReason =
  | "escaped-plot"
  | "length-limit"
  | "max-steps"
  | "invalid-value"
  | "solver-error"
  | "converged";

export interface Trajectory {
  id: string;
  seed: TrajectorySeed;
  points: StatePoint[];
  terminationReason: TerminationReason;
  totalArcLength: number;
}

export type NoticeTone = "info" | "warning" | "error";

export interface AppNotice {
  tone: NoticeTone;
  text: string;
}

export interface ComplexValue {
  real: number;
  imaginary: number;
}

export interface JacobianMatrix {
  xx: number;
  xy: number;
  yx: number;
  yy: number;
}

export interface EquilibriumCandidate extends StatePoint {
  residual: number;
}

export interface EquilibriumPointAnalysis {
  equilibrium: EquilibriumCandidate;
  jacobian: JacobianMatrix | null;
  trace: number | null;
  determinant: number | null;
  discriminant: number | null;
  eigenvalues: ComplexValue[];
  classification: string;
  stability: string;
  message: string;
}

export interface PhasePortraitAnalysis {
  availability: "available" | "unavailable";
  equilibrium: EquilibriumCandidate | null;
  equilibria: EquilibriumPointAnalysis[];
  jacobian: JacobianMatrix | null;
  trace: number | null;
  determinant: number | null;
  discriminant: number | null;
  eigenvalues: ComplexValue[];
  classification: string;
  stability: string;
  message: string;
}

export interface CompiledScalarExpression {
  source: string;
  variables: Set<"x" | "y">;
  dependsOnX: boolean;
  dependsOnY: boolean;
  latex: string;
  evaluate: (x: number, y: number) => number;
}

export interface CompiledSystem {
  xExpression: CompiledScalarExpression;
  yExpression: CompiledScalarExpression;
  latexX: string;
  latexY: string;
  evaluate: (x: number, y: number) => { dx: number; dy: number };
}

export interface VectorFieldSample {
  point: StatePoint;
  dx: number;
  dy: number;
  magnitude: number;
  strength: number;
}
