import { describe, expect, it } from "vitest";

import { computePolylineLength, createTrajectoryFlowDescriptor } from "../plot/trajectoryFlow";

describe("createTrajectoryFlowDescriptor", () => {
  it("skips flow trains that are too short to read clearly", () => {
    expect(createTrajectoryFlowDescriptor(30)).toBeNull();
  });

  it("creates a single moving segmented trail with progressively lighter layers", () => {
    const descriptor = createTrajectoryFlowDescriptor(420);

    expect(descriptor).not.toBeNull();
    expect(descriptor?.layers).toHaveLength(26);
    expect(descriptor!.concurrentTrainCount).toBeGreaterThan(1);
    expect(descriptor!.cycleLength).toBeLessThan(420);
    expect(descriptor!.dashLength).toBeGreaterThanOrEqual(8);
    expect(descriptor!.durationSeconds).toBeLessThan(1.8);
    expect(descriptor!.layers[0].gray).toBeGreaterThan(
      descriptor!.layers[descriptor!.layers.length - 1].gray
    );
    expect(descriptor!.layers[0].alpha).toBeLessThan(
      descriptor!.layers[descriptor!.layers.length - 1].alpha
    );
    expect(descriptor!.layers[0].startOffset).toBeCloseTo(0);
    expect(descriptor!.layers[descriptor!.layers.length - 1].startOffset).toBeLessThan(0);
  });

  it("falls back to a single train when the path is too short to fit several clearly", () => {
    const descriptor = createTrajectoryFlowDescriptor(120);

    expect(descriptor).not.toBeNull();
    expect(descriptor!.concurrentTrainCount).toBe(1);
    expect(descriptor!.cycleLength).toBeGreaterThan(120);
  });
});

describe("computePolylineLength", () => {
  it("measures the screen-space path length", () => {
    expect(
      computePolylineLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 6, y: 8 }
      ])
    ).toBeCloseTo(10);
  });
});
