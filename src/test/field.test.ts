import { describe, expect, it } from "vitest";

import { compileSystem } from "../math/parser";
import { colorForStrength, sampleVectorField } from "../plot/field";

const bounds = {
  xMin: -2,
  xMax: 2,
  yMin: -2,
  yMax: 2
};

describe("sampleVectorField", () => {
  it("samples the field and normalizes strengths between 0 and 1", () => {
    const system = compileSystem("x", "y");
    const samples = sampleVectorField(bounds, system, { columns: 5, rows: 4 });

    expect(samples).toHaveLength(20);
    expect(samples.every((sample) => sample.strength >= 0 && sample.strength <= 1)).toBe(true);
  });
});

describe("colorForStrength", () => {
  it("returns an HSL color string", () => {
    expect(colorForStrength(0.5)).toMatch(/^hsl\(/);
  });
});
