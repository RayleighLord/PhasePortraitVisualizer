import type { AxisBounds, CompiledSystem, VectorFieldSample } from "../types";

export function sampleVectorField(
  bounds: AxisBounds,
  system: CompiledSystem,
  options: { columns: number; rows: number }
): VectorFieldSample[] {
  const samples: VectorFieldSample[] = [];

  for (let row = 0; row < options.rows; row += 1) {
    const y = interpolate(bounds.yMax, bounds.yMin, row / Math.max(options.rows - 1, 1));

    for (let column = 0; column < options.columns; column += 1) {
      const x = interpolate(bounds.xMin, bounds.xMax, column / Math.max(options.columns - 1, 1));
      const vector = system.evaluate(x, y);
      const magnitude = Math.hypot(vector.dx, vector.dy);

      if (!Number.isFinite(magnitude)) {
        continue;
      }

      samples.push({
        point: { x, y },
        dx: vector.dx,
        dy: vector.dy,
        magnitude,
        strength: 0
      });
    }
  }

  return normalizeVectorFieldSamples(samples);
}

export function normalizeVectorFieldSamples(samples: VectorFieldSample[]): VectorFieldSample[] {
  const magnitudes = samples
    .map((sample) => sample.magnitude)
    .filter((magnitude) => Number.isFinite(magnitude))
    .sort((left, right) => left - right);

  const colorScaleMax = quantile(magnitudes, 0.9) || 1;

  return samples.map((sample) => ({
    ...sample,
    strength: clamp(sample.magnitude / colorScaleMax, 0, 1)
  }));
}

export function colorForStrength(strength: number): string {
  const clamped = clamp(strength, 0, 1);
  const hue = 205 - clamped * 180;
  const saturation = 64 + clamped * 10;
  const lightness = 66 - clamped * 18;
  return `hsl(${hue.toFixed(1)} ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`;
}

function quantile(values: number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const index = (values.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return values[lowerIndex];
  }

  const fraction = index - lowerIndex;
  return values[lowerIndex] * (1 - fraction) + values[upperIndex] * fraction;
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
