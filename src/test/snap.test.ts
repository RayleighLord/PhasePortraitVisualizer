import { describe, expect, it } from "vitest";

import { snapPointToAxes } from "../plot/snap";

const bounds = {
  xMin: -4,
  xMax: 4,
  yMin: -2,
  yMax: 2
};

describe("snapPointToAxes", () => {
  it("snaps to the visible vertical axis when close enough", () => {
    const snapped = snapPointToAxes(
      { x: 0.04, y: 1.1 },
      {
        bounds,
        scaleX: 150,
        scaleY: 120,
        axisSnapPixels: 8
      }
    );

    expect(snapped.x).toBe(0);
    expect(snapped.y).toBe(1.1);
  });

  it("snaps to the visible horizontal axis when close enough", () => {
    const snapped = snapPointToAxes(
      { x: 1.2, y: 0.03 },
      {
        bounds,
        scaleX: 150,
        scaleY: 120,
        axisSnapPixels: 8
      }
    );

    expect(snapped.x).toBe(1.2);
    expect(snapped.y).toBe(0);
  });
});
