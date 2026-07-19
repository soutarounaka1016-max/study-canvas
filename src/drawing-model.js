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

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return distance(point, start);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return distance(point, { x: start.x + ratio * dx, y: start.y + ratio * dy });
}
