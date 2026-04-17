import { describe, expect, it } from "vitest";

import { compileSystem } from "../math/parser";
import { createSolverSettings, solveTrajectory } from "../solver/rk4";
import type { CompiledSystem } from "../types";

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

  it("reuses the sampled field value at the start of each RK4 step", () => {
    const bounds = {
      xMin: -2,
      xMax: 2,
      yMin: -2,
      yMax: 2
    };
    let evaluationCount = 0;

    const system = {
      xExpression: {} as CompiledSystem["xExpression"],
      yExpression: {} as CompiledSystem["yExpression"],
      latexX: "y",
      latexY: "-x",
      evaluate: (x: number, y: number) => {
        evaluationCount += 1;
        return { dx: y, dy: -x };
      }
    } satisfies CompiledSystem;

    solveTrajectory(
      { id: "seed", x: 1, y: 0 },
      bounds,
      system,
      {
        ...createSolverSettings(bounds),
        minStepSize: 0.05,
        maxStepSize: 0.05,
        targetSpatialStep: 0.05,
        maxSteps: 1,
        maxArcLength: 10,
        blowUpThreshold: 50
      }
    );

    expect(evaluationCount).toBe(8);
  });
});
