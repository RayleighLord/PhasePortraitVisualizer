import { describe, expect, it } from "vitest";

import { computePathArrowPlacements } from "../plot/trajectoryArrows";
import { createDefaultState, createRandomSeedPoints, EXAMPLE_PRESETS } from "../ui/controller";

describe("computePathArrowPlacements", () => {
  it("places a few arrows along a long path", () => {
    const points = Array.from({ length: 80 }, (_, index) => ({
      x: index * 6,
      y: index * 2
    }));
    const placements = computePathArrowPlacements(points);

    expect(placements.length).toBeGreaterThanOrEqual(2);
    expect(placements.length).toBeLessThanOrEqual(4);
  });

  it("spreads arrows across the visible central portion of a trajectory", () => {
    const points = Array.from({ length: 120 }, (_, index) => ({
      x: index * 8,
      y: 0
    }));
    const placements = computePathArrowPlacements(points, { maxCount: 4 });

    expect(placements).toHaveLength(4);
    expect(placements[1].x - placements[0].x).toBeGreaterThan(120);
    expect(placements[2].x - placements[1].x).toBeGreaterThan(120);
    expect(placements[3].x - placements[2].x).toBeGreaterThan(120);
  });
});

describe("createRandomSeedPoints", () => {
  it("creates random seeds inside the visible window with a margin", () => {
    const seeds = createRandomSeedPoints(
      {
        xMin: -5,
        xMax: 5,
        yMin: -4,
        yMax: 4
      },
      20
    );

    expect(seeds).toHaveLength(20);
    expect(
      seeds.every(
        (seed) => seed.x >= -4.2 && seed.x <= 4.2 && seed.y >= -3.36 && seed.y <= 3.36
      )
    ).toBe(true);
  });
});

describe("EXAMPLE_PRESETS", () => {
  it("includes the nonlinear and linear showcase presets in the intended order", () => {
    const ids = EXAMPLE_PRESETS.map((preset) => preset.id);

    expect(ids[0]).toBe("saddle");
    expect(ids[ids.length - 1]).toBe("lotka-volterra");
    expect(ids).not.toContain("limit-cycle");
    expect(ids).toContain("lotka-volterra");
    expect(ids).toContain("saddle");
    expect(ids).toContain("stable-node");
    expect(ids).toContain("stable-star");
    expect(ids).toContain("unstable-node");
    expect(ids).toContain("unstable-star");
    expect(ids).toContain("stable-improper-node");
    expect(ids).toContain("unstable-improper-node");
    expect(ids).toContain("stable-spiral");
    expect(ids).toContain("unstable-spiral");
    expect(ids).toContain("center");
    expect(ids).toContain("line-of-equilibria");
    expect(ids).toContain("saddle-node");
  });

  it("assigns deterministic showcase seeds to every preset", () => {
    expect(EXAMPLE_PRESETS.every((preset) => preset.seedPoints.length >= 16)).toBe(true);
  });
});

describe("createDefaultState", () => {
  it("opens on the limit-cycle system with no trajectories shown initially", () => {
    const state = createDefaultState();

    expect(state.xExpression).toBe("y + x * (1 - x^2 - y^2)");
    expect(state.yExpression).toBe("-x + y * (1 - x^2 - y^2)");
    expect(state.curveSeeds).toHaveLength(0);
  });
});
