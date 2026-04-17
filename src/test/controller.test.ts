import { describe, expect, it } from "vitest";

import { AppController } from "../ui/controller";

describe("AppController UI-only updates", () => {
  it("does not recompute trajectories when toggling flow animation", () => {
    const controller = new AppController();
    controller.addCurveSeed({ x: 1.4, y: 0.2 });

    const before = controller.getViewModel();
    controller.setShowTrajectoryAnimation(false);
    const after = controller.getViewModel();

    expect(after.trajectories).toBe(before.trajectories);
    expect(after.state.showTrajectoryAnimation).toBe(false);
  });

  it("does not recompute trajectories when changing the selected equilibrium", () => {
    const controller = new AppController({
      xExpression: "x * (1 - x)",
      yExpression: "y * (1 - y)",
      bounds: {
        xMin: -1,
        xMax: 2,
        yMin: -1,
        yMax: 2
      },
      curveSeeds: [],
      selectedEquilibriumIndex: null,
      showTrajectoryAnimation: true,
      fieldDensity: 19,
      boundsError: null
    });

    const before = controller.getViewModel();
    controller.setSelectedEquilibriumIndex(2);
    const after = controller.getViewModel();

    expect(after.trajectories).toBe(before.trajectories);
    expect(after.analysis.equilibrium).not.toBeNull();
  });

  it("pins the saddle-node preset equilibrium at the origin", () => {
    const controller = new AppController({
      xExpression: "x^2 - y",
      yExpression: "-y",
      bounds: {
        xMin: -2,
        xMax: 2,
        yMin: -2,
        yMax: 2
      },
      curveSeeds: [],
      selectedEquilibriumIndex: null,
      showTrajectoryAnimation: true,
      fieldDensity: 19,
      boundsError: null
    });

    const { analysis } = controller.getViewModel();

    expect(analysis.equilibrium).not.toBeNull();
    expect(analysis.equilibrium?.x).toBeCloseTo(0, 8);
    expect(analysis.equilibrium?.y).toBeCloseTo(0, 8);
    expect(analysis.equilibria.some((entry) => Math.abs(entry.equilibrium.x) < 1e-9 && Math.abs(entry.equilibrium.y) < 1e-9)).toBe(true);
  });
});
