import katex from "katex";

import { colorForStrength, sampleVectorField } from "./field";
import { createCoordinateSystem, type CoordinateSystem } from "./coordinates";
import { snapPointToAxes } from "./snap";
import { computeNiceTicks, formatTickLatex } from "./ticks";
import { computePolylineLength, createTrajectoryFlowDescriptor } from "./trajectoryFlow";
import type { CompiledSystem, PlotLayout, StatePoint, Trajectory } from "../types";
import type { ViewModel } from "../ui/controller";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const EQUATION_BANNER_CLEARANCE = 78;
const Y_AXIS_LABEL_MARGIN = 54;
const CURVE_PALETTE = [
  { stroke: "#232a33", seed: "#232a33", halo: "rgba(35, 42, 51, 0.16)" },
  { stroke: "#343c45", seed: "#343c45", halo: "rgba(52, 60, 69, 0.16)" },
  { stroke: "#444d57", seed: "#444d57", halo: "rgba(68, 77, 87, 0.16)" },
  { stroke: "#57606a", seed: "#57606a", halo: "rgba(87, 96, 106, 0.16)" },
  { stroke: "#68707a", seed: "#68707a", halo: "rgba(104, 112, 122, 0.16)" },
  { stroke: "#1d252d", seed: "#1d252d", halo: "rgba(29, 37, 45, 0.16)" }
] as const;

export class PhasePortraitRenderer {
  private readonly svg: SVGSVGElement;
  private readonly layout: PlotLayout;
  private readonly gridLayer: SVGGElement;
  private readonly axisLayer: SVGGElement;
  private readonly fieldLayer: SVGGElement;
  private readonly analysisLayer: SVGGElement;
  private readonly curveLayer: SVGGElement;
  private readonly flowLayer: SVGGElement;
  private readonly annotationLayer: HTMLDivElement;
  private previousBoundsKey: string | null = null;
  private previousAnnotationProjectionKey: string | null = null;
  private previousCompiledSystem: CompiledSystem | null = null;
  private previousFieldDensity: number | null = null;
  private previousAnalysis: ViewModel["analysis"] | null = null;
  private previousTrajectories: Trajectory[] | null = null;
  private previousShowTrajectoryAnimation: boolean | null = null;
  private readonly trajectoryGeometryCache = new WeakMap<
    Trajectory,
    RenderedTrajectoryGeometryCacheEntry
  >();

  constructor(svg: SVGSVGElement) {
    this.svg = svg;
    this.layout = {
      width: 920,
      height: 700,
      padding: {
        top: EQUATION_BANNER_CLEARANCE,
        right: 14,
        bottom: 50,
        left: 72
      }
    };

    this.svg.setAttribute("viewBox", `0 0 ${this.layout.width} ${this.layout.height}`);

    this.gridLayer = createSvgElement("g", { "data-layer": "grid" });
    this.axisLayer = createSvgElement("g", { "data-layer": "axes" });
    this.fieldLayer = createSvgElement("g", { "data-layer": "field" });
    this.analysisLayer = createSvgElement("g", { "data-layer": "analysis" });
    this.curveLayer = createSvgElement("g", { "data-layer": "curves" });
    this.flowLayer = createSvgElement("g", { "data-layer": "trajectory-flow" });
    this.annotationLayer = document.createElement("div");
    this.annotationLayer.className = "plot-annotation-layer";

    this.svg.replaceChildren(
      createSvgElement("rect", {
        x: "0",
        y: "0",
        width: `${this.layout.width}`,
        height: `${this.layout.height}`,
        fill: "var(--plot-surface)"
      }),
      this.gridLayer,
      this.axisLayer,
      this.fieldLayer,
      this.analysisLayer,
      this.curveLayer,
      this.flowLayer
    );

    this.svg.parentElement?.append(this.annotationLayer);
  }

  render(viewModel: ViewModel): void {
    const coordinates = createCoordinateSystem(this.layout, viewModel.state.bounds);
    const boundsKey = serializeBounds(viewModel.state.bounds);
    const annotationProjectionKey = this.computeAnnotationProjectionKey();
    const boundsChanged = boundsKey !== this.previousBoundsKey;
    const annotationProjectionChanged =
      annotationProjectionKey !== this.previousAnnotationProjectionKey;
    const systemChanged = viewModel.compiledSystem !== this.previousCompiledSystem;
    const fieldDensityChanged = viewModel.state.fieldDensity !== this.previousFieldDensity;
    const analysisChanged = viewModel.analysis !== this.previousAnalysis;
    const trajectoriesChanged = viewModel.trajectories !== this.previousTrajectories;
    const animationChanged =
      viewModel.state.showTrajectoryAnimation !== this.previousShowTrajectoryAnimation;

    if (boundsChanged) {
      this.renderGrid(coordinates, viewModel.state.bounds);
      this.renderAxes(coordinates, viewModel.state.bounds);
    }

    if (boundsChanged || annotationProjectionChanged) {
      this.renderLatexAnnotations(coordinates, viewModel.state.bounds);
    }

    if (boundsChanged || systemChanged || fieldDensityChanged) {
      this.renderVectorField(
        coordinates,
        viewModel.state.bounds,
        viewModel.compiledSystem,
        viewModel.state.fieldDensity
      );
    }

    if (boundsChanged || analysisChanged) {
      this.renderAnalysis(coordinates, viewModel);
    }

    if (boundsChanged || trajectoriesChanged || animationChanged) {
      const renderedPaths = viewModel.trajectories
        .map((trajectory, index) =>
          this.buildRenderedTrajectoryPath(coordinates, boundsKey, trajectory, index)
        )
        .filter((path): path is RenderedTrajectoryPath => path !== null);

      this.renderCurves(renderedPaths, viewModel.state.showTrajectoryAnimation);
      this.renderTrajectoryFlow(renderedPaths, viewModel.state.showTrajectoryAnimation);
    }

    this.previousBoundsKey = boundsKey;
    this.previousAnnotationProjectionKey = annotationProjectionKey;
    this.previousCompiledSystem = viewModel.compiledSystem;
    this.previousFieldDensity = viewModel.state.fieldDensity;
    this.previousAnalysis = viewModel.analysis;
    this.previousTrajectories = viewModel.trajectories;
    this.previousShowTrajectoryAnimation = viewModel.state.showTrajectoryAnimation;
  }

  clientPointToModel(
    clientX: number,
    clientY: number,
    bounds: ViewModel["state"]["bounds"]
  ): StatePoint | null {
    const screenMatrix = this.svg.getScreenCTM();
    if (!screenMatrix) {
      return null;
    }

    const svgPoint = this.svg.createSVGPoint();
    svgPoint.x = clientX;
    svgPoint.y = clientY;
    const transformedPoint = svgPoint.matrixTransform(screenMatrix.inverse());
    const coordinates = createCoordinateSystem(this.layout, bounds);

    if (!coordinates.containsSvgPoint({ x: transformedPoint.x, y: transformedPoint.y })) {
      return null;
    }

    return coordinates.svgToModel({ x: transformedPoint.x, y: transformedPoint.y });
  }

  snapModelPoint(
    point: StatePoint,
    bounds: ViewModel["state"]["bounds"]
  ): StatePoint {
    const coordinates = createCoordinateSystem(this.layout, bounds);
    return snapPointToAxes(point, {
      bounds,
      scaleX: coordinates.scaleX,
      scaleY: coordinates.scaleY,
      axisSnapPixels: 16
    });
  }

  private renderGrid(
    coordinates: CoordinateSystem,
    bounds: ViewModel["state"]["bounds"]
  ): void {
    const xTicks = computeNiceTicks(bounds.xMin, bounds.xMax, 8);
    const yTicks = computeNiceTicks(bounds.yMin, bounds.yMax, 8);
    const nodes: SVGElement[] = [];

    nodes.push(
      createSvgElement("rect", {
        x: `${coordinates.innerLeft}`,
        y: `${coordinates.innerTop}`,
        width: `${coordinates.innerWidth}`,
        height: `${coordinates.innerHeight}`,
        rx: "18",
        fill: "transparent",
        stroke: "var(--frame-stroke)",
        "stroke-width": "1.4"
      })
    );

    xTicks.forEach((tick) => {
      const position = coordinates.modelToSvg({ x: tick, y: bounds.yMin });
      nodes.push(
        createSvgElement("line", {
          x1: `${position.x}`,
          y1: `${coordinates.innerTop}`,
          x2: `${position.x}`,
          y2: `${coordinates.innerTop + coordinates.innerHeight}`,
          stroke: "var(--grid-stroke)",
          "stroke-width": "1"
        })
      );
    });

    yTicks.forEach((tick) => {
      const position = coordinates.modelToSvg({ x: bounds.xMin, y: tick });
      nodes.push(
        createSvgElement("line", {
          x1: `${coordinates.innerLeft}`,
          y1: `${position.y}`,
          x2: `${coordinates.innerLeft + coordinates.innerWidth}`,
          y2: `${position.y}`,
          stroke: "var(--grid-stroke)",
          "stroke-width": "1"
        })
      );
    });

    this.gridLayer.replaceChildren(...nodes);
  }

  private renderAxes(
    coordinates: CoordinateSystem,
    bounds: ViewModel["state"]["bounds"]
  ): void {
    const nodes: SVGElement[] = [];

    if (bounds.yMin <= 0 && bounds.yMax >= 0) {
      const horizontal = coordinates.modelToSvg({ x: bounds.xMin, y: 0 });
      nodes.push(
        createSvgElement("line", {
          x1: `${coordinates.innerLeft}`,
          y1: `${horizontal.y}`,
          x2: `${coordinates.innerLeft + coordinates.innerWidth}`,
          y2: `${horizontal.y}`,
          stroke: "var(--axis-stroke)",
          "stroke-width": "1.6"
        })
      );
    }

    if (bounds.xMin <= 0 && bounds.xMax >= 0) {
      const vertical = coordinates.modelToSvg({ x: 0, y: bounds.yMin });
      nodes.push(
        createSvgElement("line", {
          x1: `${vertical.x}`,
          y1: `${coordinates.innerTop}`,
          x2: `${vertical.x}`,
          y2: `${coordinates.innerTop + coordinates.innerHeight}`,
          stroke: "var(--axis-stroke)",
          "stroke-width": "1.6"
        })
      );
    }

    this.axisLayer.replaceChildren(...nodes);
  }

  private renderVectorField(
    coordinates: CoordinateSystem,
    bounds: ViewModel["state"]["bounds"],
    system: CompiledSystem | null,
    density: number
  ): void {
    if (!system) {
      this.fieldLayer.replaceChildren();
      return;
    }

    const columns = density;
    const rows = Math.max(10, Math.round((coordinates.innerHeight / coordinates.innerWidth) * density));
    const screenSpacing = Math.min(
      coordinates.innerWidth / Math.max(columns, 2),
      coordinates.innerHeight / Math.max(rows, 2)
    );
    const arrowLength = screenSpacing * 0.7;
    const samples = sampleVectorField(bounds, system, { columns, rows });
    const nodes: SVGElement[] = [];

    for (const sample of samples) {
      const screenVector = normalizeVector({
        x: sample.dx * coordinates.scaleX,
        y: -sample.dy * coordinates.scaleY
      });

      if (!screenVector) {
        continue;
      }

      const center = coordinates.modelToSvg(sample.point);
      const tip = {
        x: center.x + screenVector.x * arrowLength * 0.5,
        y: center.y + screenVector.y * arrowLength * 0.5
      };
      const tail = {
        x: center.x - screenVector.x * arrowLength * 0.5,
        y: center.y - screenVector.y * arrowLength * 0.5
      };
      const headBase = {
        x: tip.x - screenVector.x * 7,
        y: tip.y - screenVector.y * 7
      };
      const normal = {
        x: -screenVector.y,
        y: screenVector.x
      };
      const color = colorForStrength(sample.strength);

      nodes.push(
        createSvgElement("line", {
          x1: `${tail.x}`,
          y1: `${tail.y}`,
          x2: `${headBase.x}`,
          y2: `${headBase.y}`,
          stroke: color,
          "stroke-width": "2.1",
          "stroke-linecap": "round",
          opacity: "0.9"
        }),
        createSvgElement("polygon", {
          points: [
            `${tip.x},${tip.y}`,
            `${headBase.x + normal.x * 4.8},${headBase.y + normal.y * 4.8}`,
            `${headBase.x - normal.x * 4.8},${headBase.y - normal.y * 4.8}`
          ].join(" "),
          fill: color,
          opacity: "0.95"
        })
      );
    }

    this.fieldLayer.replaceChildren(...nodes);
  }

  private renderAnalysis(coordinates: CoordinateSystem, viewModel: ViewModel): void {
    if (viewModel.analysis.equilibria.length === 0) {
      this.analysisLayer.replaceChildren();
      return;
    }

    const selected = viewModel.analysis.equilibrium;
    const nodes: SVGElement[] = [];

    viewModel.analysis.equilibria.forEach((equilibriumAnalysis) => {
      const point = coordinates.modelToSvg(equilibriumAnalysis.equilibrium);
      const isSelected =
        selected &&
        Math.abs(selected.x - equilibriumAnalysis.equilibrium.x) < 1e-6 &&
        Math.abs(selected.y - equilibriumAnalysis.equilibrium.y) < 1e-6;

      nodes.push(
        createSvgElement("circle", {
          cx: `${point.x}`,
          cy: `${point.y}`,
          r: isSelected ? "9.5" : "7.2",
          fill: isSelected ? "rgba(32, 32, 32, 0.08)" : "rgba(32, 32, 32, 0.04)"
        }),
        createSvgElement("circle", {
          cx: `${point.x}`,
          cy: `${point.y}`,
          r: isSelected ? "4.2" : "3.2",
          fill: isSelected ? "rgba(20, 20, 20, 0.92)" : "rgba(20, 20, 20, 0.72)"
        })
      );
    });

    this.analysisLayer.replaceChildren(...nodes);
  }

  private renderCurves(
    renderedPaths: RenderedTrajectoryPath[],
    showTrajectoryAnimation: boolean
  ): void {
    const nodes: SVGElement[] = [];

    renderedPaths.forEach((renderedPath) => {
      nodes.push(
        createSvgElement("path", {
          d: renderedPath.pathData,
          fill: "none",
          stroke: showTrajectoryAnimation ? "rgba(152, 160, 169, 0.46)" : renderedPath.palette.stroke,
          "stroke-width": showTrajectoryAnimation ? "4.45" : "4.55",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          opacity: "0.96"
        })
      );
    });

    this.curveLayer.replaceChildren(...nodes);
  }

  private renderTrajectoryFlow(
    renderedPaths: RenderedTrajectoryPath[],
    showTrajectoryAnimation: boolean
  ): void {
    if (!showTrajectoryAnimation) {
      this.flowLayer.replaceChildren();
      return;
    }

    const nodes: SVGElement[] = [];
    const currentTimeSeconds = performance.now() / 1000;

    renderedPaths.forEach((renderedPath) => {
      const flowDescriptor = createTrajectoryFlowDescriptor(renderedPath.screenArcLength);
      if (!flowDescriptor) {
        return;
      }

      const dashGap = flowDescriptor.cycleLength - flowDescriptor.dashLength;
      const trajectoryPhaseShift = renderedPath.phaseOffset * flowDescriptor.cycleLength;
      const animationDelaySeconds = computeNegativeAnimationDelaySeconds(
        flowDescriptor.durationSeconds,
        currentTimeSeconds
      );

      flowDescriptor.layers.forEach((layer) => {
        const startOffset = layer.startOffset - trajectoryPhaseShift;
        nodes.push(
          createSvgElement("path", {
            d: renderedPath.pathData,
            fill: "none",
            stroke: formatGrayscaleStroke(layer.gray, layer.alpha),
            "stroke-width": `${layer.strokeWidth.toFixed(2)}`,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            "stroke-dasharray": `${flowDescriptor.dashLength.toFixed(2)} ${dashGap.toFixed(2)}`,
            class: "trajectory-flow-segment",
            style: [
              `--trajectory-flow-start:${startOffset.toFixed(2)}px`,
              `--trajectory-flow-end:${(startOffset - flowDescriptor.cycleLength).toFixed(2)}px`,
              `--trajectory-flow-duration:${flowDescriptor.durationSeconds.toFixed(2)}s`,
              `--trajectory-flow-delay:${animationDelaySeconds.toFixed(3)}s`
            ].join(";")
          })
        );
      });
    });

    this.flowLayer.replaceChildren(...nodes);
  }

  private renderLatexAnnotations(
    coordinates: CoordinateSystem,
    bounds: ViewModel["state"]["bounds"]
  ): void {
    const screenMatrix = this.svg.getScreenCTM();
    const layerRect = this.annotationLayer.getBoundingClientRect();

    if (!screenMatrix || layerRect.width === 0 || layerRect.height === 0) {
      this.annotationLayer.replaceChildren();
      return;
    }

    const xTicks = computeNiceTicks(bounds.xMin, bounds.xMax, 8);
    const yTicks = computeNiceTicks(bounds.yMin, bounds.yMax, 8);
    const nodes: HTMLDivElement[] = [];

    xTicks.forEach((tick) => {
      const position = coordinates.modelToSvg({ x: tick, y: bounds.yMin });
      const layerPoint = this.projectToOverlay(
        position.x,
        coordinates.innerTop + coordinates.innerHeight + 42,
        screenMatrix,
        layerRect
      );

      nodes.push(
        createLatexOverlayLabel({
          x: clamp(layerPoint.x, 42, layerRect.width - 42),
          y: layerPoint.y,
          latex: formatTickLatex(tick),
          className: "plot-latex-label tick-label"
        })
      );
    });

    yTicks.forEach((tick) => {
      const position = coordinates.modelToSvg({ x: bounds.xMin, y: tick });
      const layerPoint = this.projectToOverlay(
        coordinates.innerLeft - 18,
        position.y,
        screenMatrix,
        layerRect
      );

      nodes.push(
        createLatexOverlayLabel({
          x: Math.max(layerPoint.x, 62),
          y: clamp(layerPoint.y, 16, layerRect.height - 16),
          latex: formatTickLatex(tick),
          className: "plot-latex-label tick-label is-y"
        })
      );
    });

    const xAxisPoint = this.projectToOverlay(
      coordinates.innerLeft + coordinates.innerWidth / 2,
      this.layout.height + 10,
      screenMatrix,
      layerRect
    );
    nodes.push(
      createLatexOverlayLabel({
        x: xAxisPoint.x,
        y: xAxisPoint.y,
        latex: "x",
        className: "plot-latex-label axis-label"
      })
    );

    const yAxisPoint = this.projectToOverlay(
      coordinates.innerLeft - Y_AXIS_LABEL_MARGIN,
      coordinates.innerTop + coordinates.innerHeight / 2,
      screenMatrix,
      layerRect
    );
    nodes.push(
      createLatexOverlayLabel({
        x: yAxisPoint.x,
        y: yAxisPoint.y,
        latex: "y",
        className: "plot-latex-label axis-label vertical"
      })
    );

    this.annotationLayer.replaceChildren(...nodes);
  }

  private projectToOverlay(
    x: number,
    y: number,
    screenMatrix: DOMMatrix,
    layerRect: DOMRect
  ): { x: number; y: number } {
    const point = this.svg.createSVGPoint();
    point.x = x;
    point.y = y;
    const screenPoint = point.matrixTransform(screenMatrix);

    return {
      x: screenPoint.x - layerRect.left,
      y: screenPoint.y - layerRect.top
    };
  }

  private computeAnnotationProjectionKey(): string {
    const screenMatrix = this.svg.getScreenCTM();
    const layerRect = this.annotationLayer.getBoundingClientRect();

    if (!screenMatrix) {
      return "no-screen-matrix";
    }

    return [
      screenMatrix.a,
      screenMatrix.b,
      screenMatrix.c,
      screenMatrix.d,
      layerRect.width,
      layerRect.height
    ]
      .map((value) => value.toFixed(4))
      .join("|");
  }

  private buildRenderedTrajectoryPath(
    coordinates: CoordinateSystem,
    boundsKey: string,
    trajectory: Trajectory,
    index: number
  ): RenderedTrajectoryPath | null {
    const geometry = this.getRenderedTrajectoryGeometry(coordinates, boundsKey, trajectory);
    if (!geometry) {
      return null;
    }

    return {
      pathData: geometry.pathData,
      screenArcLength: geometry.screenArcLength,
      palette: CURVE_PALETTE[index % CURVE_PALETTE.length],
      phaseOffset: fractionalPart(index * 0.61803398875)
    };
  }

  private getRenderedTrajectoryGeometry(
    coordinates: CoordinateSystem,
    boundsKey: string,
    trajectory: Trajectory
  ): RenderedTrajectoryGeometry | null {
    const cached = this.trajectoryGeometryCache.get(trajectory);
    if (cached?.boundsKey === boundsKey) {
      return cached.geometry;
    }

    const svgPoints = trajectory.points.map((point) => coordinates.modelToSvg(point));
    const geometry =
      svgPoints.length < 2
        ? null
        : {
            pathData: svgPoints
              .map((point, pointIndex) => {
                return `${pointIndex === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
              })
              .join(" "),
            screenArcLength: computePolylineLength(svgPoints)
          };

    this.trajectoryGeometryCache.set(trajectory, {
      boundsKey,
      geometry
    });

    return geometry;
  }
}

interface RenderedTrajectoryPath {
  pathData: string;
  screenArcLength: number;
  palette: (typeof CURVE_PALETTE)[number];
  phaseOffset: number;
}

interface RenderedTrajectoryGeometry {
  pathData: string;
  screenArcLength: number;
}

interface RenderedTrajectoryGeometryCacheEntry {
  boundsKey: string;
  geometry: RenderedTrajectoryGeometry | null;
}

function createSvgElement<TagName extends keyof SVGElementTagNameMap>(
  tagName: TagName,
  attributes: Record<string, string>,
  textContent?: string
): SVGElementTagNameMap[TagName] {
  const element = document.createElementNS(SVG_NAMESPACE, tagName) as SVGElementTagNameMap[TagName];
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });

  if (textContent) {
    element.textContent = textContent;
  }

  return element;
}

function createLatexOverlayLabel(options: {
  x: number;
  y: number;
  latex: string;
  className: string;
}): HTMLDivElement {
  const element = document.createElement("div");
  element.className = options.className;
  element.style.left = `${options.x}px`;
  element.style.top = `${options.y}px`;
  element.innerHTML = katex.renderToString(options.latex, {
    throwOnError: false,
    displayMode: false
  });
  return element;
}

function normalizeVector(vector: { x: number; y: number }): { x: number; y: number } | null {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 1e-12) {
    return null;
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatGrayscaleStroke(gray: number, alpha: number): string {
  const channel = Math.round(gray);
  return `rgba(${channel}, ${channel}, ${channel}, ${alpha.toFixed(3)})`;
}

function serializeBounds(bounds: ViewModel["state"]["bounds"]): string {
  return `${bounds.xMin}|${bounds.xMax}|${bounds.yMin}|${bounds.yMax}`;
}

function fractionalPart(value: number): number {
  return value - Math.floor(value);
}

function computeNegativeAnimationDelaySeconds(durationSeconds: number, currentTimeSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }

  const phaseSeconds = currentTimeSeconds % durationSeconds;
  return -phaseSeconds;
}
