import "./selection-dom.js";
import {
  cloneDrawing,
  deleteSelectedStrokes,
  getSelectedStrokeBounds,
  moveSelectedStrokes,
  scaleSelectedStrokes,
  selectStrokeIdsByLasso,
} from "./drawing-model.js";

export class SelectionController {
  constructor(getDrawing, commitDrawing) {
    if (typeof getDrawing !== "function" || typeof commitDrawing !== "function") {
      throw new Error("SELECTION_CALLBACKS_REQUIRED");
    }
    this.getDrawing = getDrawing;
    this.commitDrawing = commitDrawing;
    this.selectedIds = new Set();
    this.lasso = null;
    this.drag = null;
    this.resize = null;
    this.draft = null;
  }

  get hasSelection() {
    return this.selectedIds.size > 0;
  }

  get displayDrawing() {
    return this.draft || this.getDrawing();
  }

  get bounds() {
    return getSelectedStrokeBounds(this.displayDrawing, this.selectedIds);
  }

  begin(point) {
    const drawing = this.getDrawing();
    const bounds = getSelectedStrokeBounds(drawing, this.selectedIds);
    const resizeHandle = bounds ? getResizeHandleAtPoint(bounds, point) : null;

    if (resizeHandle) {
      this.resize = {
        ...resizeHandle,
        start: point,
        drawing: cloneDrawing(drawing),
        moved: false,
      };
      this.draft = cloneDrawing(drawing);
      return "resize";
    }

    if (bounds && pointInsideBounds(point, bounds, 24)) {
      this.drag = { start: point, drawing: cloneDrawing(drawing), moved: false };
      this.draft = cloneDrawing(drawing);
      return "drag";
    }

    this.selectedIds = new Set();
    this.lasso = [point];
    this.draft = null;
    return "lasso";
  }

  move(point) {
    if (this.lasso) {
      const previous = this.lasso.at(-1);
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) {
        this.lasso.push(point);
      }
      return;
    }

    if (this.resize) {
      const handleX = this.resize.handle.x - this.resize.anchor.x;
      const handleY = this.resize.handle.y - this.resize.anchor.y;
      const lengthSquared = handleX * handleX + handleY * handleY;
      const movedX = point.x - this.resize.start.x;
      const movedY = point.y - this.resize.start.y;
      const scale = lengthSquared > 0
        ? 1 + (movedX * handleX + movedY * handleY) / lengthSquared
        : 1;
      this.resize.moved = this.resize.moved || Math.hypot(movedX, movedY) >= 0.8;
      this.draft = scaleSelectedStrokes(
        this.resize.drawing,
        this.selectedIds,
        this.resize.anchor,
        scale,
      );
      return;
    }

    if (this.drag) {
      const dx = point.x - this.drag.start.x;
      const dy = point.y - this.drag.start.y;
      this.drag.moved = this.drag.moved || Math.hypot(dx, dy) >= 0.8;
      this.draft = moveSelectedStrokes(this.drag.drawing, this.selectedIds, dx, dy);
    }
  }

  end() {
    let changed = false;
    if (this.lasso) {
      this.selectedIds = new Set(selectStrokeIdsByLasso(this.getDrawing(), this.lasso));
    } else if (this.drag?.moved && this.draft) {
      this.commitDrawing(this.draft);
      changed = true;
    } else if (this.resize?.moved && this.draft) {
      this.commitDrawing(this.draft);
      changed = true;
    }

    this.lasso = null;
    this.drag = null;
    this.resize = null;
    this.draft = null;
    return changed;
  }

  cancel() {
    this.lasso = null;
    this.drag = null;
    this.resize = null;
    this.draft = null;
  }

  clear() {
    this.selectedIds = new Set();
    this.cancel();
  }

  deleteSelected() {
    if (!this.hasSelection) return false;
    this.commitDrawing(deleteSelectedStrokes(this.getDrawing(), this.selectedIds));
    this.clear();
    return true;
  }

  selectedDrawing() {
    const drawing = this.getDrawing();
    const selectedIds = this.selectedIds;
    return {
      version: drawing.version,
      date: drawing.date || "",
      strokes: drawing.strokes
        .filter((stroke) => selectedIds.has(stroke.id))
        .map((stroke) => cloneDrawing({ version: drawing.version, date: drawing.date || "", strokes: [stroke] }).strokes[0]),
    };
  }

  drawOverlay(context) {
    const drawing = this.displayDrawing;
    context.save();
    context.strokeStyle = "#2558e6";
    context.fillStyle = "rgb(37 88 230 / 8%)";
    context.lineWidth = 3;
    context.setLineDash([12, 8]);

    if (this.lasso?.length) {
      context.beginPath();
      context.moveTo(this.lasso[0].x, this.lasso[0].y);
      for (const point of this.lasso.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
    }

    const bounds = getSelectedStrokeBounds(drawing, this.selectedIds);
    if (bounds) {
      const padding = 14;
      const x = bounds.minX - padding;
      const y = bounds.minY - padding;
      const width = bounds.maxX - bounds.minX + padding * 2;
      const height = bounds.maxY - bounds.minY + padding * 2;
      context.fillRect(x, y, width, height);
      context.strokeRect(x, y, width, height);
      context.setLineDash([]);
      for (const { handle } of getResizeHandles(bounds)) drawHandle(context, handle);
    }
    context.restore();
  }
}

export function pointInsideBounds(point, bounds, padding = 0) {
  return point.x >= bounds.minX - padding && point.x <= bounds.maxX + padding
    && point.y >= bounds.minY - padding && point.y <= bounds.maxY + padding;
}

export function getResizeHandles(bounds) {
  const padding = 14;
  const minimumX = Math.max(12, bounds.minX - padding);
  const minimumY = Math.max(12, bounds.minY - padding);
  const maximumX = Math.min(1500 - 12, bounds.maxX + padding);
  const maximumY = Math.min(1000 - 12, bounds.maxY + padding);
  return [
    { corner: "north-west", handle: { x: minimumX, y: minimumY }, anchor: { x: bounds.maxX, y: bounds.maxY } },
    { corner: "north-east", handle: { x: maximumX, y: minimumY }, anchor: { x: bounds.minX, y: bounds.maxY } },
    { corner: "south-east", handle: { x: maximumX, y: maximumY }, anchor: { x: bounds.minX, y: bounds.minY } },
    { corner: "south-west", handle: { x: minimumX, y: maximumY }, anchor: { x: bounds.maxX, y: bounds.minY } },
  ];
}

export function getResizeHandleAtPoint(bounds, point) {
  return getResizeHandles(bounds)
    .find(({ handle }) => Math.hypot(point.x - handle.x, point.y - handle.y) <= 32) || null;
}

function drawHandle(context, point) {
  context.beginPath();
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#2558e6";
  context.lineWidth = 5;
  context.arc(point.x, point.y, 12, 0, Math.PI * 2);
  context.fill();
  context.stroke();
}
