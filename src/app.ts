import katex from "katex";

import { PhasePortraitRenderer } from "./plot/renderer";
import { AppController, EXAMPLE_PRESETS, type ViewModel } from "./ui/controller";
import type { AxisBounds, ComplexValue, JacobianMatrix } from "./types";

export function startApp(): void {
  const xEquationInput = getElement<HTMLTextAreaElement>("x-equation-input");
  const yEquationInput = getElement<HTMLTextAreaElement>("y-equation-input");
  const xEquationPrefix = getElement<HTMLElement>("x-equation-prefix");
  const yEquationPrefix = getElement<HTMLElement>("y-equation-prefix");
  const exampleSelect = getElement<HTMLSelectElement>("example-select");
  const boundsForm = getElement<HTMLFormElement>("bounds-form");
  const xMinInput = getElement<HTMLInputElement>("x-min-input");
  const xMaxInput = getElement<HTMLInputElement>("x-max-input");
  const yMinInput = getElement<HTMLInputElement>("y-min-input");
  const yMaxInput = getElement<HTMLInputElement>("y-max-input");
  const heroEquation = getElement<HTMLElement>("hero-equation");
  const plotSystemPreview = getElement<HTMLElement>("plot-system-preview");
  const resetButton = getElement<HTMLButtonElement>("reset-button");
  const clearCurvesButton = getElement<HTMLButtonElement>("clear-curves-button");
  const seedRingButton = getElement<HTMLButtonElement>("seed-ring-button");
  const trajectoryAnimationToggle = getElement<HTMLInputElement>("trajectory-animation-toggle");
  const equationStatus = getElement<HTMLElement>("equation-status");
  const equilibriumSelect = getElement<HTMLSelectElement>("equilibrium-select");
  const jacobianDisplay = getElement<HTMLElement>("jacobian-display");
  const eigenvalueDisplay = getElement<HTMLElement>("eigenvalue-display");
  const classificationDisplay = getElement<HTMLElement>("classification-display");
  const allEquilibriaDisplay = getElement<HTMLElement>("all-equilibria-display");
  const curveCount = getElement<HTMLElement>("curve-count");
  const noticeList = getElement<HTMLUListElement>("notice-list");
  const plot = getElement<SVGSVGElement>("portrait-plot");

  const controller = new AppController();
  const renderer = new PhasePortraitRenderer(plot);

  populateExampleSelect(exampleSelect);
  renderLatex(xEquationPrefix, "x' =", false);
  renderLatex(yEquationPrefix, "y' =", false);
  renderLatex(
    heroEquation,
    String.raw`\left\{\begin{aligned} x' &= f(x, y) \\ y' &= g(x, y) \end{aligned}\right.`,
    true
  );

  let pendingResizeFrame = 0;
  const schedulePlotRender = () => {
    if (pendingResizeFrame !== 0) {
      return;
    }

    pendingResizeFrame = window.requestAnimationFrame(() => {
      pendingResizeFrame = 0;
      renderer.render(controller.getViewModel());
    });
  };

  controller.subscribe((viewModel) => {
    renderer.render(viewModel);
    renderSystemPreview(viewModel, plotSystemPreview);
    syncInputs(viewModel.state.bounds, {
      xEquationInput,
      yEquationInput,
      xMinInput,
      xMaxInput,
      yMinInput,
      yMaxInput,
      trajectoryAnimationToggle
    }, viewModel.state.xExpression, viewModel.state.yExpression, viewModel.state.showTrajectoryAnimation);
    renderStatus(viewModel, {
      equationStatus,
      equilibriumSelect,
      jacobianDisplay,
      eigenvalueDisplay,
      classificationDisplay,
      allEquilibriaDisplay,
      curveCount,
      noticeList
    });
  });

  const resizeObserver = new ResizeObserver(() => {
    schedulePlotRender();
  });
  resizeObserver.observe(plot);
  if (plot.parentElement) {
    resizeObserver.observe(plot.parentElement);
  }
  window.addEventListener("resize", schedulePlotRender);

  const syncExpressions = () => {
    controller.setExpressions({
      xExpression: xEquationInput.value,
      yExpression: yEquationInput.value
    });
  };

  xEquationInput.addEventListener("input", syncExpressions);
  yEquationInput.addEventListener("input", syncExpressions);
  exampleSelect.addEventListener("change", () => {
    if (exampleSelect.value) {
      controller.loadExamplePreset(exampleSelect.value);
    }
  });
  equilibriumSelect.addEventListener("change", () => {
    const value = equilibriumSelect.value;
    controller.setSelectedEquilibriumIndex(value === "" ? null : Number(value));
  });

  boundsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    controller.applyBounds({
      xMin: Number(xMinInput.value),
      xMax: Number(xMaxInput.value),
      yMin: Number(yMinInput.value),
      yMax: Number(yMaxInput.value)
    });
  });

  resetButton.addEventListener("click", () => {
    controller.reset();
    exampleSelect.value = "";
  });

  clearCurvesButton.addEventListener("click", () => {
    controller.clearCurves();
  });

  seedRingButton.addEventListener("click", () => {
    controller.sampleTrajectories();
  });
  trajectoryAnimationToggle.addEventListener("change", () => {
    controller.setShowTrajectoryAnimation(trajectoryAnimationToggle.checked);
  });

  plot.addEventListener("click", (event) => {
    const viewModel = controller.getViewModel();
    if (!viewModel.compiledSystem || viewModel.equationError) {
      return;
    }

    const modelPoint = renderer.clientPointToModel(
      event.clientX,
      event.clientY,
      viewModel.state.bounds
    );

    if (!modelPoint) {
      return;
    }

    controller.addCurveSeed(renderer.snapModelPoint(modelPoint, viewModel.state.bounds));
  });
}

function populateExampleSelect(select: HTMLSelectElement): void {
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose example";

  select.replaceChildren(
    placeholder,
    ...EXAMPLE_PRESETS.map((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      return option;
    })
  );

  select.value = "";
}

function syncInputs(
  bounds: AxisBounds,
  elements: {
    xEquationInput: HTMLTextAreaElement;
    yEquationInput: HTMLTextAreaElement;
    xMinInput: HTMLInputElement;
    xMaxInput: HTMLInputElement;
    yMinInput: HTMLInputElement;
    yMaxInput: HTMLInputElement;
    trajectoryAnimationToggle: HTMLInputElement;
  },
  xExpression: string,
  yExpression: string,
  showTrajectoryAnimation: boolean
): void {
  if (elements.xEquationInput.value !== xExpression) {
    elements.xEquationInput.value = xExpression;
  }

  if (elements.yEquationInput.value !== yExpression) {
    elements.yEquationInput.value = yExpression;
  }

  syncNumberInput(elements.xMinInput, bounds.xMin);
  syncNumberInput(elements.xMaxInput, bounds.xMax);
  syncNumberInput(elements.yMinInput, bounds.yMin);
  syncNumberInput(elements.yMaxInput, bounds.yMax);
  elements.trajectoryAnimationToggle.checked = showTrajectoryAnimation;
}

function syncNumberInput(input: HTMLInputElement, value: number): void {
  const serialized = `${value}`;
  if (input.value !== serialized) {
    input.value = serialized;
  }
}

function renderStatus(
  viewModel: ViewModel,
  elements: {
    equationStatus: HTMLElement;
    equilibriumSelect: HTMLSelectElement;
    jacobianDisplay: HTMLElement;
    eigenvalueDisplay: HTMLElement;
    classificationDisplay: HTMLElement;
    allEquilibriaDisplay: HTMLElement;
    curveCount: HTMLElement;
    noticeList: HTMLUListElement;
  }
): void {
  const isValid = !viewModel.equationError;
  elements.equationStatus.textContent = isValid ? "Ready" : "Needs attention";
  elements.equationStatus.className = `status-chip ${isValid ? "is-valid" : "is-invalid"}`;

  syncEquilibriumSelect(viewModel, elements.equilibriumSelect);

  renderMathValue(
    elements.jacobianDisplay,
    viewModel.analysis.jacobian ? formatJacobianLatex(viewModel.analysis.jacobian) : null
  );
  renderMathValue(
    elements.eigenvalueDisplay,
    viewModel.analysis.eigenvalues.length > 0
      ? formatEigenvalueLatex(viewModel.analysis.eigenvalues)
      : null
  );

  elements.classificationDisplay.textContent =
    viewModel.analysis.availability === "available"
      ? viewModel.analysis.classification
      : viewModel.analysis.message;

  renderEquilibriaList(viewModel, elements.allEquilibriaDisplay);

  elements.curveCount.textContent = `${viewModel.trajectories.length}`;

  elements.noticeList.classList.toggle("is-empty", viewModel.notices.length === 0);
  elements.noticeList.replaceChildren(
    ...viewModel.notices.map((notice) => {
      const item = document.createElement("li");
      item.className = `notice-item tone-${notice.tone}`;
      item.textContent = notice.text;
      return item;
    })
  );
}

function syncEquilibriumSelect(viewModel: ViewModel, select: HTMLSelectElement): void {
  if (viewModel.analysis.equilibria.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Unavailable";
    select.replaceChildren(option);
    select.value = "";
    select.disabled = true;
    return;
  }

  select.disabled = false;
  const options = viewModel.analysis.equilibria.map((entry, index) => {
    const option = document.createElement("option");
    option.value = `${index}`;
    option.textContent = `${formatPoint(entry.equilibrium)} — ${entry.classification}`;
    return option;
  });

  select.replaceChildren(...options);
  const selectedIndex = viewModel.analysis.equilibria.findIndex(
    (entry) =>
      viewModel.analysis.equilibrium &&
      Math.abs(entry.equilibrium.x - viewModel.analysis.equilibrium.x) < 1e-6 &&
      Math.abs(entry.equilibrium.y - viewModel.analysis.equilibrium.y) < 1e-6
  );
  select.value = `${Math.max(selectedIndex, 0)}`;
}

function renderEquilibriaList(viewModel: ViewModel, element: HTMLElement): void {
  if (viewModel.analysis.equilibria.length === 0) {
    element.textContent = "None detected in the current window.";
    return;
  }

  element.replaceChildren(
    ...viewModel.analysis.equilibria.map((entry) => {
      const item = document.createElement("div");
      item.className = "equilibrium-summary-item";
      item.textContent = `${formatPoint(entry.equilibrium)} — ${entry.classification} (${entry.stability})`;
      return item;
    })
  );
}

function renderSystemPreview(viewModel: ViewModel, element: HTMLElement): void {
  if (viewModel.compiledSystem && !viewModel.equationError) {
    element.classList.remove("is-invalid");
    renderLatex(
      element,
      String.raw`\left\{\begin{aligned} x' &= ${viewModel.compiledSystem.latexX} \\ y' &= ${viewModel.compiledSystem.latexY} \end{aligned}\right.`,
      true
    );
    return;
  }

  element.classList.add("is-invalid");
  element.textContent = viewModel.equationError ?? "Unable to render the current system.";
}

function renderMathValue(element: HTMLElement, latex: string | null): void {
  if (!latex) {
    element.textContent = "Unavailable";
    return;
  }

  renderLatex(element, latex, false);
}

function renderLatex(element: HTMLElement, latex: string, displayMode: boolean): void {
  katex.render(latex, element, {
    throwOnError: false,
    displayMode
  });
}

function formatPoint(point: { x: number; y: number }): string {
  return `(${formatCompactNumber(point.x)}, ${formatCompactNumber(point.y)})`;
}

function formatCompactNumber(value: number): string {
  return `${Number(value.toFixed(4))}`;
}

function formatJacobianLatex(jacobian: JacobianMatrix): string {
  return String.raw`\begin{bmatrix}
${formatCompactNumber(jacobian.xx)} & ${formatCompactNumber(jacobian.xy)} \\
${formatCompactNumber(jacobian.yx)} & ${formatCompactNumber(jacobian.yy)}
\end{bmatrix}`;
}

function formatEigenvalueLatex(eigenvalues: ComplexValue[]): string {
  if (eigenvalues.length !== 2) {
    return String.raw`\text{Unavailable}`;
  }

  return String.raw`\lambda_1 = ${formatComplexLatex(eigenvalues[0])},\quad \lambda_2 = ${formatComplexLatex(
    eigenvalues[1]
  )}`;
}

function formatComplexLatex(value: ComplexValue): string {
  if (Math.abs(value.imaginary) < 1e-9) {
    return formatCompactNumber(value.real);
  }

  const sign = value.imaginary >= 0 ? "+" : "-";
  return `${formatCompactNumber(value.real)} ${sign} ${formatCompactNumber(Math.abs(value.imaginary))} i`;
}

function getElement<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element with id "${id}".`);
  }
  return element as unknown as T;
}
