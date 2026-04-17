import type { AxisBounds, PlotLayout, StatePoint } from "../types";

export interface CoordinateSystem {
  innerLeft: number;
  innerTop: number;
  innerWidth: number;
  innerHeight: number;
  scaleX: number;
  scaleY: number;
  modelToSvg: (point: StatePoint) => { x: number; y: number };
  svgToModel: (point: { x: number; y: number }) => StatePoint;
  containsSvgPoint: (point: { x: number; y: number }) => boolean;
}

export function createCoordinateSystem(
  layout: PlotLayout,
  bounds: AxisBounds
): CoordinateSystem {
  const availableLeft = layout.padding.left;
  const availableTop = layout.padding.top;
  const availableWidth = layout.width - layout.padding.left - layout.padding.right;
  const availableHeight = layout.height - layout.padding.top - layout.padding.bottom;
  const spanX = bounds.xMax - bounds.xMin;
  const spanY = bounds.yMax - bounds.yMin;
  const scale = Math.min(availableWidth / spanX, availableHeight / spanY);
  const innerWidth = spanX * scale;
  const innerHeight = spanY * scale;
  const innerLeft = availableLeft + (availableWidth - innerWidth) / 2;
  const innerTop = availableTop + (availableHeight - innerHeight) / 2;

  return {
    innerLeft,
    innerTop,
    innerWidth,
    innerHeight,
    scaleX: scale,
    scaleY: scale,
    modelToSvg(point) {
      return {
        x: innerLeft + (point.x - bounds.xMin) * scale,
        y: innerTop + (bounds.yMax - point.y) * scale
      };
    },
    svgToModel(point) {
      return {
        x: bounds.xMin + (point.x - innerLeft) / scale,
        y: bounds.yMax - (point.y - innerTop) / scale
      };
    },
    containsSvgPoint(point) {
      return (
        point.x >= innerLeft &&
        point.x <= innerLeft + innerWidth &&
        point.y >= innerTop &&
        point.y <= innerTop + innerHeight
      );
    }
  };
}
