import { BASE_HEIGHT, BASE_WIDTH, getSelectedStrokeBounds } from "./drawing-model.js";

export function renderDrawingPreview(canvas, drawing) {
  const context = canvas.getContext("2d", { alpha: false });
  const width = canvas.width;
  const height = canvas.height;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  const ids = new Set(drawing.strokes.map((stroke) => stroke.id));
  const bounds = getSelectedStrokeBounds(drawing, ids);
  if (!bounds) return;

  const padding = 28;
  const drawingWidth = Math.max(1, bounds.maxX - bounds.minX);
  const drawingHeight = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(
    (width - padding * 2) / drawingWidth,
    (height - padding * 2) / drawingHeight,
  );
  const offsetX = (width - drawingWidth * scale) / 2 - bounds.minX * scale;
  const offsetY = (height - drawingHeight * scale) / 2 - bounds.minY * scale;
  context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  for (const stroke of drawing.strokes) drawStroke(context, stroke);
}

export function drawLassoOverlay(canvas, points) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!points.length) return;
  context.save();
  context.strokeStyle = "#2558e6";
  context.fillStyle = "rgb(37 88 230 / 10%)";
  context.lineWidth = 4;
  context.setLineDash([14, 10]);
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  if (points.length >= 3) {
    context.closePath();
    context.fill();
  }
  context.stroke();
  context.restore();
}

export function getCanvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(BASE_WIDTH, ((event.clientX - rect.left) / rect.width) * BASE_WIDTH)),
    y: Math.max(0, Math.min(BASE_HEIGHT, ((event.clientY - rect.top) / rect.height) * BASE_HEIGHT)),
  };
}

function drawStroke(context, stroke) {
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = "round";
  context.lineJoin = "round";
  if (stroke.points.length === 1) {
    context.beginPath();
    context.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }
  context.beginPath();
  context.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let index = 1; index < stroke.points.length - 1; index += 1) {
    const current = stroke.points[index];
    const next = stroke.points[index + 1];
    context.quadraticCurveTo(
      current.x,
      current.y,
      (current.x + next.x) / 2,
      (current.y + next.y) / 2,
    );
  }
  const last = stroke.points.at(-1);
  context.lineTo(last.x, last.y);
  context.stroke();
}

export const TASKIZE_CANVAS_SIZE = { width: BASE_WIDTH, height: BASE_HEIGHT };
