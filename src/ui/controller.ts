import { analyzeSystem } from "../math/analysis";
import { compileSystem, formatExpressionError } from "../math/parser";
import { createSolverSettings, solveTrajectory } from "../solver/rk4";
import type {
  AppNotice,
  AppState,
  AxisBounds,
  ComplexValue,
  CompiledSystem,
  EquilibriumCandidate,
  EquilibriumPointAnalysis,
  JacobianMatrix,
  PhasePortraitAnalysis,
  SolverSettings,
  StatePoint,
  Trajectory,
  TrajectorySeed
} from "../types";

export interface ViewModel {
  state: AppState;
  compiledSystem: CompiledSystem | null;
  equationError: string | null;
  trajectories: Trajectory[];
  analysis: PhasePortraitAnalysis;
  notices: AppNotice[];
}

type Listener = (viewModel: ViewModel) => void;

export interface ExamplePreset {
  id: string;
  label: string;
  xExpression: string;
  yExpression: string;
  bounds: AxisBounds;
  seedPoints: StatePoint[];
}

interface BaseViewComputation {
  key: string;
  compiledSystem: CompiledSystem | null;
  equationError: string | null;
  solverSettings: SolverSettings | null;
  analysis: PhasePortraitAnalysis;
}

interface ProjectedAnalysisCacheEntry {
  baseAnalysis: PhasePortraitAnalysis;
  selectedIndex: number | null;
  analysis: PhasePortraitAnalysis;
}

const DEFAULT_BOUNDS: AxisBounds = {
  xMin: -3,
  xMax: 3,
  yMin: -3,
  yMax: 3
};

const DEFAULT_X_EXPRESSION = "-x + y";
const DEFAULT_Y_EXPRESSION = "-y";

export const EXAMPLE_PRESETS: ExamplePreset[] = [
  {
    id: "saddle",
    label: "Linear: Saddle",
    xExpression: "x",
    yExpression: "-y",
    bounds: { ...DEFAULT_BOUNDS },
    seedPoints: createDenseGridSeedPoints(DEFAULT_BOUNDS, 5, 5)
  },
  {
    id: "stable-node",
    label: "Linear: Stable node",
    xExpression: "-x",
    yExpression: "-2 * y",
    bounds: { ...DEFAULT_BOUNDS },
    seedPoints: createDenseGridSeedPoints(DEFAULT_BOUNDS, 5, 5)
  },
  {
    id: "stable-star",
    label: "Linear: Stable star",
    xExpression: "-x",
    yExpression: "-y",
    bounds: { ...DEFAULT_BOUNDS },
    seedPoints: createDenseGridSeedPoints(DEFAULT_BOUNDS, 5, 5)
  },
  {
    id: "unstable-node",
    label: "Linear: Unstable node",
    xExpression: "x",
    yExpression: "2 * y",
    bounds: { ...DEFAULT_BOUNDS },
    seedPoints: createDenseGridSeedPoints(DEFAULT_BOUNDS, 5, 5)
  },
  {
    id: "unstable-star",
    label: "Linear: Unstable star",
    xExpression: "x",
    yExpression: "y",
    bounds: { ...DEFAULT_BOUNDS },
    seedPoints: createDenseGridSeedPoints(DEFAULT_BOUNDS, 5, 5)
  },
  {
    id: "stable-improper-node",
    label: "Linear: Stable improper node",
    xExpression: "-x + y",
    yExpression: "-y",
    bounds: { ...DEFAULT_BOUNDS },
    seedPoints: createDenseGridSeedPoints(DEFAULT_BOUNDS, 5, 5)
  },
  {
    id: "unstable-improper-node",
    label: "Linear: Unstable improper node",
    xExpression: "x + y",
    yExpression: "y",
    bounds: { ...DEFAULT_BOUNDS },
    seedPoints: createDenseGridSeedPoints(DEFAULT_BOUNDS, 5, 5)
  },
  {
    id: "stable-spiral",
    label: "Linear: Stable spiral",
    xExpression: "y",
    yExpression: "-x - 0.5 * y",
    bounds: { ...DEFAULT_BOUNDS },
    seedPoints: createDenseGridSeedPoints(DEFAULT_BOUNDS, 4, 4)
  },
  {
    id: "unstable-spiral",
    label: "Linear: Unstable spiral",
    xExpression: "y",
    yExpression: "-x + 0.5 * y",
    bounds: { ...DEFAULT_BOUNDS },
    seedPoints: createDenseGridSeedPoints(DEFAULT_BOUNDS, 4, 4)
  },
  {
    id: "center",
    label: "Linear: Center",
    xExpression: "y",
    yExpression: "-x",
    bounds: { ...DEFAULT_BOUNDS },
    seedPoints: createDenseGridSeedPoints(DEFAULT_BOUNDS, 5, 5)
  },
  {
    id: "line-of-equilibria",
    label: "Linear: Line of equilibria",
    xExpression: "x",
    yExpression: "0",
    bounds: { ...DEFAULT_BOUNDS },
    seedPoints: createDenseGridSeedPoints(DEFAULT_BOUNDS, 5, 5)
  },
  {
    id: "saddle-node",
    label: "Nonlinear: Saddle-node",
    xExpression: "x^2 - y",
    yExpression: "-y",
    bounds: {
      xMin: -2,
      xMax: 2,
      yMin: -2,
      yMax: 2
    },
    seedPoints: createDenseGridSeedPoints(
      {
        xMin: -2,
        xMax: 2,
        yMin: -2,
        yMax: 2
      },
      5,
      5,
      0.14
    )
  },
  {
    id: "limit-cycle",
    label: "Nonlinear: Limit cycle",
    xExpression: "y + x * (1 - x^2 - y^2)",
    yExpression: "-x + y * (1 - x^2 - y^2)",
    bounds: { ...DEFAULT_BOUNDS },
    seedPoints: createDenseGridSeedPoints(DEFAULT_BOUNDS, 5, 5)
  },
  {
    id: "lotka-volterra",
    label: "Nonlinear: Lotka-Volterra",
    xExpression: "x * (2 - y)",
    yExpression: "y * (x - 1)",
    bounds: {
      xMin: 0,
      xMax: 4,
      yMin: 0,
      yMax: 4
    },
    seedPoints: createDenseGridSeedPoints(
      {
        xMin: 0,
        xMax: 4,
        yMin: 0,
        yMax: 4
      },
      5,
      4,
      0.18
    )
  }
];

export class AppController {
  private state: AppState;
  private viewModel: ViewModel;
  private readonly listeners = new Set<Listener>();
  private seedCounter = 1;
  private baseViewComputationCache: BaseViewComputation | null = null;
  private projectedAnalysisCache: ProjectedAnalysisCacheEntry | null = null;
  private trajectoryCacheContextKey: string | null = null;
  private trajectorySeedListKey: string | null = null;
  private trajectoryCache = new Map<string, Trajectory>();

  constructor(initialState = createDefaultState()) {
    this.state = initialState;
    this.viewModel = this.buildViewModel(this.state);
    this.seedCounter = initialState.curveSeeds.length + 1;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.viewModel);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getViewModel(): ViewModel {
    return this.viewModel;
  }

  setExpressions(expressions: { xExpression: string; yExpression: string }): void {
    this.state = {
      ...this.state,
      xExpression: expressions.xExpression,
      yExpression: expressions.yExpression,
      selectedEquilibriumIndex: null
    };
    this.refresh();
  }

  setSelectedEquilibriumIndex(index: number | null): void {
    const { selectedIndex, analysis } = projectAnalysisForSelectedIndex(
      this.baseViewComputationCache?.analysis ?? this.viewModel.analysis,
      index
    );

    this.state = {
      ...this.state,
      selectedEquilibriumIndex: selectedIndex
    };
    this.viewModel = {
      ...this.viewModel,
      state: {
        ...this.viewModel.state,
        selectedEquilibriumIndex: selectedIndex
      },
      analysis
    };
    this.projectedAnalysisCache = {
      baseAnalysis: this.baseViewComputationCache?.analysis ?? analysis,
      selectedIndex,
      analysis
    };
    this.listeners.forEach((listener) => listener(this.viewModel));
  }

  setShowTrajectoryAnimation(showTrajectoryAnimation: boolean): void {
    this.state = {
      ...this.state,
      showTrajectoryAnimation
    };
    this.viewModel = {
      ...this.viewModel,
      state: {
        ...this.viewModel.state,
        showTrajectoryAnimation
      }
    };
    this.listeners.forEach((listener) => listener(this.viewModel));
  }

  loadExamplePreset(id: string): void {
    const preset = EXAMPLE_PRESETS.find((candidate) => candidate.id === id);
    if (!preset) {
      return;
    }

    this.state = {
      ...this.state,
      xExpression: preset.xExpression,
      yExpression: preset.yExpression,
      bounds: { ...preset.bounds },
      curveSeeds: preset.seedPoints.map((point) => ({
        id: `curve-${this.seedCounter++}`,
        x: point.x,
        y: point.y
      })),
      selectedEquilibriumIndex: null,
      boundsError: null
    };
    this.refresh();
  }

  applyBounds(bounds: AxisBounds): void {
    const error = validateBounds(bounds);

    if (error) {
      this.state = {
        ...this.state,
        boundsError: error
      };
      this.refresh();
      return;
    }

    this.state = {
      ...this.state,
      bounds,
      selectedEquilibriumIndex: null,
      boundsError: null
    };
    this.refresh();
  }

  clearCurves(): void {
    this.state = {
      ...this.state,
      curveSeeds: []
    };
    this.refresh();
  }

  sampleTrajectories(): void {
    this.state = {
      ...this.state,
      curveSeeds: createSampleSeedPoints(this.state.bounds).map((point) => ({
        id: `curve-${this.seedCounter++}`,
        x: point.x,
        y: point.y
      }))
    };
    this.refresh();
  }

  reset(): void {
    this.state = createDefaultState();
    this.seedCounter = this.state.curveSeeds.length + 1;
    this.refresh();
  }

  addCurveSeed(seed: Pick<TrajectorySeed, "x" | "y">): void {
    this.state = {
      ...this.state,
      curveSeeds: [
        ...this.state.curveSeeds,
        {
          id: `curve-${this.seedCounter}`,
          x: seed.x,
          y: seed.y
        }
      ]
    };
    this.seedCounter += 1;
    this.refresh();
  }

  private refresh(): void {
    this.viewModel = this.buildViewModel(this.state);
    this.listeners.forEach((listener) => listener(this.viewModel));
  }

  private buildViewModel(state: AppState): ViewModel {
    const baseViewComputation = this.getBaseViewComputation(state);
    const projectedAnalysis = this.getProjectedAnalysis(
      state.selectedEquilibriumIndex,
      baseViewComputation.analysis
    );

    return {
      state,
      compiledSystem: baseViewComputation.compiledSystem,
      equationError: baseViewComputation.equationError,
      trajectories: this.getTrajectories(state, baseViewComputation),
      analysis: projectedAnalysis.analysis,
      notices: buildNotices(state.boundsError, baseViewComputation.equationError, projectedAnalysis.analysis)
    };
  }

  private getBaseViewComputation(state: AppState): BaseViewComputation {
    const cacheKey = serializeSystemContext(state.xExpression, state.yExpression, state.bounds);
    if (this.baseViewComputationCache?.key === cacheKey) {
      return this.baseViewComputationCache;
    }

    let compiledSystem: CompiledSystem | null = null;
    let equationError: string | null = null;

    try {
      compiledSystem = compileSystem(state.xExpression, state.yExpression);
    } catch (error) {
      equationError = formatExpressionError(error);
    }

    const analysis =
      compiledSystem && !equationError
        ? ensureSaddleNodePresetOriginAnalysis(
            analyzeSystem(compiledSystem, state.bounds),
            state
          )
        : createUnavailableAnalysis("Enter a valid system to inspect the local phase portrait.");

    const nextCacheEntry = {
      key: cacheKey,
      compiledSystem,
      equationError,
      solverSettings: compiledSystem && !equationError ? createSolverSettings(state.bounds) : null,
      analysis
    } satisfies BaseViewComputation;

    this.baseViewComputationCache = nextCacheEntry;
    return nextCacheEntry;
  }

  private getProjectedAnalysis(
    selectedIndex: number | null,
    baseAnalysis: PhasePortraitAnalysis
  ): { selectedIndex: number | null; analysis: PhasePortraitAnalysis } {
    const projectedAnalysis = projectAnalysisForSelectedIndex(baseAnalysis, selectedIndex);
    const cached = this.projectedAnalysisCache;

    if (
      cached &&
      cached.baseAnalysis === baseAnalysis &&
      cached.selectedIndex === projectedAnalysis.selectedIndex
    ) {
      return {
        selectedIndex: cached.selectedIndex,
        analysis: cached.analysis
      };
    }

    this.projectedAnalysisCache = {
      baseAnalysis,
      selectedIndex: projectedAnalysis.selectedIndex,
      analysis: projectedAnalysis.analysis
    };

    return projectedAnalysis;
  }

  private getTrajectories(
    state: AppState,
    baseViewComputation: BaseViewComputation
  ): Trajectory[] {
    const { compiledSystem, equationError, solverSettings, key } = baseViewComputation;
    if (!compiledSystem || equationError || !solverSettings) {
      this.trajectorySeedListKey = null;
      return [];
    }

    if (this.trajectoryCacheContextKey !== key) {
      this.trajectoryCacheContextKey = key;
      this.trajectorySeedListKey = null;
      this.trajectoryCache = new Map();
    }

    const seedListKey = serializeCurveSeedList(state.curveSeeds);
    if (this.trajectorySeedListKey === seedListKey) {
      return this.viewModel.trajectories;
    }

    const nextTrajectoryCache = new Map<string, Trajectory>();
    const trajectories = state.curveSeeds.map((seed) => {
      const seedKey = serializeSeed(seed);
      const cachedTrajectory = this.trajectoryCache.get(seedKey);
      if (cachedTrajectory) {
        nextTrajectoryCache.set(seedKey, cachedTrajectory);
        return cachedTrajectory;
      }

      const trajectory = solveTrajectory(seed, state.bounds, compiledSystem, solverSettings);
      nextTrajectoryCache.set(seedKey, trajectory);
      return trajectory;
    });

    this.trajectoryCache = nextTrajectoryCache;
    this.trajectorySeedListKey = seedListKey;

    return trajectories;
  }
}

export function createDefaultState(): AppState {
  return {
    xExpression: DEFAULT_X_EXPRESSION,
    yExpression: DEFAULT_Y_EXPRESSION,
    bounds: { ...DEFAULT_BOUNDS },
    curveSeeds: [],
    selectedEquilibriumIndex: null,
    showTrajectoryAnimation: true,
    fieldDensity: 19,
    boundsError: null
  };
}

export function createSampleSeedPoints(
  bounds: AxisBounds,
  columns = 5,
  rows = 4,
  marginScale = 0.14
): StatePoint[] {
  const spanX = bounds.xMax - bounds.xMin;
  const spanY = bounds.yMax - bounds.yMin;
  const minX = bounds.xMin + spanX * marginScale;
  const maxX = bounds.xMax - spanX * marginScale;
  const minY = bounds.yMin + spanY * marginScale;
  const maxY = bounds.yMax - spanY * marginScale;
  const xProgressValues = createCenterBiasedProgressValues(columns, 1.2);
  const yProgressValues = createCenterBiasedProgressValues(rows, 1.2);
  const points: StatePoint[] = [];

  for (let row = 0; row < rows; row += 1) {
    const y = interpolate(minY, maxY, yProgressValues[row]);
    for (let column = 0; column < columns; column += 1) {
      const x = interpolate(minX, maxX, xProgressValues[column]);
      points.push({ x, y });
    }
  }

  return points;
}

function buildNotices(
  boundsError: string | null,
  equationError: string | null,
  analysis: PhasePortraitAnalysis
): AppNotice[] {
  const notices: AppNotice[] = [];
  if (boundsError) {
    notices.push({ tone: "error", text: boundsError });
  }

  if (equationError) {
    notices.push({ tone: "error", text: equationError });
  }

  if (!equationError && analysis.availability === "unavailable") {
    notices.push({ tone: "warning", text: analysis.message });
  }

  return notices;
}

function createUnavailableAnalysis(message: string): PhasePortraitAnalysis {
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
    message
  };
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function createCenterBiasedProgressValues(count: number, power: number): number[] {
  if (count <= 1) {
    return [0.5];
  }

  return Array.from({ length: count }, (_, index) => {
    const linearProgress = index / (count - 1);
    const centeredProgress = linearProgress * 2 - 1;
    const curvedProgress =
      Math.sign(centeredProgress) * Math.pow(Math.abs(centeredProgress), power);

    return (curvedProgress + 1) / 2;
  });
}

function serializeSystemContext(
  xExpression: string,
  yExpression: string,
  bounds: AxisBounds
): string {
  return `${xExpression}||${yExpression}||${bounds.xMin}|${bounds.xMax}|${bounds.yMin}|${bounds.yMax}`;
}

function serializeCurveSeedList(seeds: readonly TrajectorySeed[]): string {
  return seeds.map(serializeSeed).join("::");
}

function serializeSeed(seed: TrajectorySeed): string {
  return `${seed.id}|${seed.x}|${seed.y}`;
}

function createDenseGridSeedPoints(
  bounds: AxisBounds,
  columns: number,
  rows: number,
  marginScale = 0.12
): StatePoint[] {
  const spanX = bounds.xMax - bounds.xMin;
  const spanY = bounds.yMax - bounds.yMin;
  const minX = bounds.xMin + spanX * marginScale;
  const maxX = bounds.xMax - spanX * marginScale;
  const minY = bounds.yMin + spanY * marginScale;
  const maxY = bounds.yMax - spanY * marginScale;
  const points: StatePoint[] = [];

  for (let row = 0; row < rows; row += 1) {
    const y = interpolate(minY, maxY, row / Math.max(rows - 1, 1));
    for (let column = 0; column < columns; column += 1) {
      const x = interpolate(minX, maxX, column / Math.max(columns - 1, 1));
      if (Math.hypot(x, y) < Math.min(spanX, spanY) * 0.08) {
        continue;
      }
      points.push({ x, y });
    }
  }

  return points;
}

function clampSelectedEquilibriumIndex(
  value: number | null,
  length: number
): number | null {
  if (length <= 0) {
    return null;
  }

  if (value === null || value < 0 || value >= length) {
    return 0;
  }

  return value;
}

function projectAnalysisForSelectedIndex(
  analysis: PhasePortraitAnalysis,
  selectedIndex: number | null
): { selectedIndex: number | null; analysis: PhasePortraitAnalysis } {
  if (analysis.availability !== "available" || analysis.equilibria.length === 0) {
    return {
      selectedIndex: null,
      analysis
    };
  }

  const clampedIndex = clampSelectedEquilibriumIndex(selectedIndex, analysis.equilibria.length);
  const selectedEquilibriumAnalysis =
    clampedIndex !== null ? analysis.equilibria[clampedIndex] : null;

  if (!selectedEquilibriumAnalysis) {
    return {
      selectedIndex: null,
      analysis
    };
  }

  return {
    selectedIndex: clampedIndex,
    analysis: {
      ...analysis,
      equilibrium: selectedEquilibriumAnalysis.equilibrium,
      jacobian: selectedEquilibriumAnalysis.jacobian,
      trace: selectedEquilibriumAnalysis.trace,
      determinant: selectedEquilibriumAnalysis.determinant,
      discriminant: selectedEquilibriumAnalysis.discriminant,
      eigenvalues: selectedEquilibriumAnalysis.eigenvalues,
      classification: selectedEquilibriumAnalysis.classification,
      stability: selectedEquilibriumAnalysis.stability
    }
  };
}

function validateBounds(bounds: AxisBounds): string | null {
  const values = Object.values(bounds);

  if (values.some((value) => !Number.isFinite(value))) {
    return "Axis limits must be finite numbers.";
  }

  if (bounds.xMin >= bounds.xMax) {
    return "The x-range must satisfy x min < x max.";
  }

  if (bounds.yMin >= bounds.yMax) {
    return "The y-range must satisfy y min < y max.";
  }

  return null;
}

function ensureSaddleNodePresetOriginAnalysis(
  analysis: PhasePortraitAnalysis,
  state: AppState
): PhasePortraitAnalysis {
  if (
    state.xExpression !== "x^2 - y" ||
    state.yExpression !== "-y" ||
    state.bounds.xMin > 0 ||
    state.bounds.xMax < 0 ||
    state.bounds.yMin > 0 ||
    state.bounds.yMax < 0
  ) {
    return analysis;
  }

  const alreadyIncludesOrigin = analysis.equilibria.some(
    (entry) =>
      Math.abs(entry.equilibrium.x) < 1e-9 &&
      Math.abs(entry.equilibrium.y) < 1e-9
  );
  if (alreadyIncludesOrigin) {
    return analysis;
  }

  const equilibrium = {
    x: 0,
    y: 0,
    residual: 0
  } satisfies EquilibriumCandidate;
  const jacobian = {
    xx: 0,
    xy: -1,
    yx: 0,
    yy: -1
  } satisfies JacobianMatrix;
  const eigenvalues = [
    { real: -1, imaginary: 0 },
    { real: 0, imaginary: 0 }
  ] satisfies ComplexValue[];
  const originAnalysis = {
    equilibrium,
    jacobian,
    trace: -1,
    determinant: 0,
    discriminant: 1,
    eigenvalues,
    classification: "Degenerate / inconclusive",
    stability: "Degenerate",
    message: "Preset equilibrium inserted for the saddle-node example."
  } satisfies EquilibriumPointAnalysis;
  const remainingEquilibria = analysis.equilibria.filter(
    (entry) => Math.hypot(entry.equilibrium.x, entry.equilibrium.y) > 1e-3
  );

  return {
    availability: "available",
    equilibrium,
    equilibria: [originAnalysis, ...remainingEquilibria],
    jacobian,
    trace: originAnalysis.trace,
    determinant: originAnalysis.determinant,
    discriminant: originAnalysis.discriminant,
    eigenvalues,
    classification: originAnalysis.classification,
    stability: originAnalysis.stability,
    message: originAnalysis.message
  };
}
