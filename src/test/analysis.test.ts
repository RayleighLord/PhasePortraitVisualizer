import { describe, expect, it } from "vitest";

import { analyzeSystem, findEquilibria } from "../math/analysis";
import { compileSystem } from "../math/parser";

const bounds = {
  xMin: -3,
  xMax: 3,
  yMin: -3,
  yMax: 3
};

describe("findEquilibria", () => {
  it("finds the origin for a linear system", () => {
    const system = compileSystem("y", "-x - 0.3 * y");
    const equilibria = findEquilibria(system, bounds);

    expect(equilibria).toHaveLength(1);
    expect(equilibria[0].x).toBeCloseTo(0, 6);
    expect(equilibria[0].y).toBeCloseTo(0, 6);
  });

  it("finds multiple equilibria when more than one is visible", () => {
    const system = compileSystem("x * (1 - x)", "y * (1 - y)");
    const equilibria = findEquilibria(system, {
      xMin: -1,
      xMax: 2,
      yMin: -1,
      yMax: 2
    });

    expect(equilibria.length).toBeGreaterThanOrEqual(4);
  });

});

describe("analyzeSystem", () => {
  it("classifies a saddle", () => {
    const system = compileSystem("x", "-y");
    const analysis = analyzeSystem(system, bounds);

    expect(analysis.availability).toBe("available");
    expect(analysis.classification).toBe("Saddle");
  });

  it("classifies a stable spiral", () => {
    const system = compileSystem("y", "-x - 0.3 * y");
    const analysis = analyzeSystem(system, bounds);

    expect(analysis.availability).toBe("available");
    expect(analysis.classification).toBe("Stable spiral");
    expect(analysis.eigenvalues[0].imaginary).not.toBe(0);
  });

  it("classifies a center", () => {
    const system = compileSystem("y", "-x");
    const analysis = analyzeSystem(system, bounds);

    expect(analysis.availability).toBe("available");
    expect(analysis.classification).toBe("Center");
  });

  it("returns per-equilibrium classifications when multiple equilibria are visible", () => {
    const system = compileSystem("x * (1 - x)", "y * (1 - y)");
    const analysis = analyzeSystem(system, {
      xMin: -1,
      xMax: 2,
      yMin: -1,
      yMax: 2
    });

    expect(analysis.availability).toBe("available");
    expect(analysis.equilibria.length).toBeGreaterThanOrEqual(4);
    expect(analysis.equilibria.every((entry) => entry.classification.length > 0)).toBe(true);
    expect(analysis.equilibria.every((entry) => entry.stability.length > 0)).toBe(true);
  });
});
