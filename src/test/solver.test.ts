import { describe, expect, it } from "vitest";

import { compileSystem } from "../math/parser";
import { createSolverSettings, solveTrajectory } from "../solver/rk4";

describe("solveTrajectory", () => {
  it("tracks a smooth planar rotation over many steps", () => {
    const bounds = {
      xMin: -2,
      xMax: 2,
      yMin: -2,
      yMax: 2
    };
    const system = compileSystem("y", "-x");
    const trajectory = solveTrajectory(
      { id: "seed", x: 1, y: 0 },
      bounds,
      system,
      createSolverSettings(bounds)
    );

    expect(trajectory.points.length).toBeGreaterThan(20);
    expect(trajectory.totalArcLength).toBeGreaterThan(1);
  });

  it("stops when the trajectory exits the visible plot", () => {
    const bounds = {
      xMin: -2,
      xMax: 2,
      yMin: -2,
      yMax: 2
    };
    const system = compileSystem("x", "y");
    const trajectory = solveTrajectory(
      { id: "seed", x: 0.5, y: 0.5 },
      bounds,
      system,
      createSolverSettings(bounds)
    );

    expect(trajectory.terminationReason).toBe("escaped-plot");
  });
});
