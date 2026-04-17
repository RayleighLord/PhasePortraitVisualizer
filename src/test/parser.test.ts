import { describe, expect, it } from "vitest";

import { compileScalarExpression, compileSystem } from "../math/parser";

describe("compileScalarExpression", () => {
  it("evaluates parsed expressions with x and y", () => {
    const expression = compileScalarExpression("sin(x) - y^2");
    const value = expression.evaluate(Math.PI / 2, 3);

    expect(value).toBeCloseTo(-8, 8);
  });

  it("generates LaTeX for rendered previews", () => {
    const expression = compileScalarExpression("x + 2 * y");

    expect(expression.latex).toBe("x + 2 \\cdot y");
  });

  it("compiles a two-equation system", () => {
    const system = compileSystem("y", "-x - 0.3 * y");
    const value = system.evaluate(2, -1);

    expect(value.dx).toBe(-1);
    expect(value.dy).toBeCloseTo(-1.7, 8);
  });

  it("rejects malformed expressions", () => {
    expect(() => compileScalarExpression("sin(")).toThrow();
    expect(() => compileSystem("x", "foo + y")).toThrow();
  });
});
