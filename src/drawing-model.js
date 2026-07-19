export const DRAWING_VERSION = 1;
export const BASE_WIDTH = 1500;
export const BASE_HEIGHT = 1000;

export function emptyDrawing(date = "") {
  return { version: DRAWING_VERSION, date, strokes: [] };
}

export function cloneDrawing(drawing) {
  return {
    version: DRAWING_VERSION,
    date: drawing.date || "",
    strokes: drawing.strokes.map((stroke) => ({
      id: stroke.id,
      color: stroke.color,
      width: stroke.width,
      points: stroke.points.map((point) => ({ x: point.x, y: point.y })),
    })),
  };
}

export function parseSavedDrawing(raw, date = "") {
  if (!raw) return emptyDrawing(date);

  try {
    const value = JSON.parse(raw);
    if (value?.version !== DRAWING_VERSION || !Array.isArray(value.strokes)) return emptyDrawing(date);

    const strokes = value.strokes.filter(isValidStroke).map((stroke) => ({
      id: String(stroke.id),
      color: stroke.color,
      width: Number(stroke.width),
      points: stroke.points.map((point) => ({ x: Number(point.x), y: Number(point.y) })),
    }));
    return { version: DRAWING_VERSION, date: value.date || date, strokes };
  } catch {
    return emptyDrawing(date);
  }
}

function isValidStroke(stroke) {
  return Boolean(
    stroke &&
      typeof stroke.id !== "undefined" &&
      typeof stroke.color === "string" &&
      Number.isFinite(Number(stroke.width)) &&
      Number(stroke.width) > 0 &&
      Array.isArray(stroke.points) &&
      stroke.points.length > 0 &&
      stroke.points.every(
        (point) =>
          Number.isFinite(Number(point?.x)) &&
          Number.isFinite(Number(point?.y)) &&
          Number(point.x) >= 0 &&
          Number(point.x) <= BASE_WIDTH &&
          Number(point.y) >= 0 &&
          Number(point.y) <= BASE_HEIGHT,
      ),
  );
}

export class DrawingHistory {
  constructor(initialDrawing, limit = 80) {
    this.current = cloneDrawing(initialDrawing);
    this.undoStack = [];
    this.redoStack = [];
    this.limit = limit;
  }

  commit(nextDrawing) {
    this.undoStack.push(cloneDrawing(this.current));
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.current = cloneDrawing(nextDrawing);
    this.redoStack = [];
    return this.current;
  }

  undo() {
    if (!this.canUndo) return this.current;
    this.redoStack.push(cloneDrawing(this.current));
    this.current = this.undoStack.pop();
    return this.current;
  }

  redo() {
    if (!this.canRedo) return this.current;
    this.undoStack.push(cloneDrawing(this.current));
    this.current = this.redoStack.pop();
    return this.current;
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}

export function strokeTouchesPoint(stroke, point, radius) {
  const threshold = radius + stroke.width / 2;
  if (stroke.points.length === 1) return distance(stroke.points[0], point) <= threshold;

  for (let index = 1; index < stroke.points.length; index += 1) {
    if (distanceToSegment(point, stroke.points[index - 1], stroke.points[index]) <= threshold) return true;
  }
  return false;
}

export function selectStrokeIdsByLasso(drawing, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return [];
  return drawing.strokes
    .filter((stroke) => strokeIntersectsPolygon(stroke, polygon))
    .map((stroke) => stroke.id);
}

export function getSelectedStrokeBounds(drawing, selectedIds) {
  const ids = new Set(selectedIds);
  const points = drawing.strokes
    .filter((stroke) => ids.has(stroke.id))
    .flatMap((stroke) => stroke.points);
  if (points.length === 0) return null;
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

export function moveSelectedStrokes(drawing, selectedIds, dx, dy) {
  const ids = new Set(selectedIds);
  const bounds = getSelectedStrokeBounds(drawing, ids);
  if (!bounds || !Number.isFinite(dx) || !Number.isFinite(dy)) return cloneDrawing(drawing);
  const safeDx = Math.max(-bounds.minX, Math.min(dx, BASE_WIDTH - bounds.maxX));
  const safeDy = Math.max(-bounds.minY, Math.min(dy, BASE_HEIGHT - bounds.maxY));
  const moved = cloneDrawing(drawing);
  for (const stroke of moved.strokes) {
    if (!ids.has(stroke.id)) continue;
    for (const point of stroke.points) {
      point.x += safeDx;
      point.y += safeDy;
    }
  }
  return moved;
}

export function deleteSelectedStrokes(drawing, selectedIds) {
  const ids = new Set(selectedIds);
  const nextDrawing = cloneDrawing(drawing);
  nextDrawing.strokes = nextDrawing.strokes.filter((stroke) => !ids.has(stroke.id));
  return nextDrawing;
}

export function scaleSelectedStrokes(drawing, selectedIds, anchor, scale) {
  const ids = new Set(selectedIds);
  const bounds = getSelectedStrokeBounds(drawing, ids);
  if (!bounds || !Number.isFinite(anchor?.x) || !Number.isFinite(anchor?.y) || !Number.isFinite(scale)) {
    return cloneDrawing(drawing);
  }

  const requestedScale = Math.max(0.2, scale);
  const safeScale = Math.min(requestedScale, getMaximumScale(bounds, anchor));
  const scaled = cloneDrawing(drawing);
  for (const stroke of scaled.strokes) {
    if (!ids.has(stroke.id)) continue;
    stroke.width *= safeScale;
    for (const point of stroke.points) {
      point.x = anchor.x + (point.x - anchor.x) * safeScale;
      point.y = anchor.y + (point.y - anchor.y) * safeScale;
    }
  }
  return scaled;
}

function getMaximumScale(bounds, anchor) {
  let maximum = Number.POSITIVE_INFINITY;
  for (const x of [bounds.minX, bounds.maxX]) {
    const distanceFromAnchor = x - anchor.x;
    if (distanceFromAnchor > 0) maximum = Math.min(maximum, (BASE_WIDTH - anchor.x) / distanceFromAnchor);
    if (distanceFromAnchor < 0) maximum = Math.min(maximum, -anchor.x / distanceFromAnchor);
  }
  for (const y of [bounds.minY, bounds.maxY]) {
    const distanceFromAnchor = y - anchor.y;
    if (distanceFromAnchor > 0) maximum = Math.min(maximum, (BASE_HEIGHT - anchor.y) / distanceFromAnchor);
    if (distanceFromAnchor < 0) maximum = Math.min(maximum, -anchor.y / distanceFromAnchor);
  }
  return maximum;
}

function strokeIntersectsPolygon(stroke, polygon) {
  if (stroke.points.some((point) => pointInPolygon(point, polygon))) return true;
  for (let strokeIndex = 1; strokeIndex < stroke.points.length; strokeIndex += 1) {
    const strokeStart = stroke.points[strokeIndex - 1];
    const strokeEnd = stroke.points[strokeIndex];
    for (let polygonIndex = 0; polygonIndex < polygon.length; polygonIndex += 1) {
      const polygonStart = polygon[polygonIndex];
      const polygonEnd = polygon[(polygonIndex + 1) % polygon.length];
      if (segmentsIntersect(strokeStart, strokeEnd, polygonStart, polygonEnd)) return true;
    }
  }
  return false;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
    const start = polygon[current];
    const end = polygon[previous];
    const crosses = (start.y > point.y) !== (end.y > point.y) &&
      point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
  const firstA = cross(firstStart, firstEnd, secondStart);
  const firstB = cross(firstStart, firstEnd, secondEnd);
  const secondA = cross(secondStart, secondEnd, firstStart);
  const secondB = cross(secondStart, secondEnd, firstEnd);
  if (firstA === 0 && pointOnSegment(secondStart, firstStart, firstEnd)) return true;
  if (firstB === 0 && pointOnSegment(secondEnd, firstStart, firstEnd)) return true;
  if (secondA === 0 && pointOnSegment(firstStart, secondStart, secondEnd)) return true;
  if (secondB === 0 && pointOnSegment(firstEnd, secondStart, secondEnd)) return true;
  return (firstA > 0) !== (firstB > 0) && (secondA > 0) !== (secondB > 0);
}

function cross(start, end, point) {
  return (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
}

function pointOnSegment(point, start, end) {
  return point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x) &&
    point.y >= Math.min(start.y, end.y) && point.y <= Math.max(start.y, end.y);
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return distance(point, start);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return distance(point, { x: start.x + ratio * dx, y: start.y + ratio * dy });
}
