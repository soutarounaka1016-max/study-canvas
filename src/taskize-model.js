import { addTask, getTasksForDate, validateTaskInput } from "./task-store.js";
import { cloneDrawing, selectStrokeIdsByLasso } from "./drawing-model.js";

export function selectDrawingByLasso(drawing, lassoPoints) {
  const selectedIds = new Set(selectStrokeIdsByLasso(drawing, lassoPoints));
  const copy = cloneDrawing(drawing);
  copy.strokes = copy.strokes.filter((stroke) => selectedIds.has(stroke.id));
  return copy;
}

export function hasDuplicateTask(store, date, input) {
  const safeInput = validateTaskInput(input);
  return getTasksForDate(store, date).some((task) => (
    task.subject === safeInput.subject
    && task.title === safeInput.title
    && task.plannedMinutes === safeInput.plannedMinutes
  ));
}

export function addTaskFromHandwriting(store, date, input, id) {
  const safeInput = validateTaskInput(input);
  if (hasDuplicateTask(store, date, safeInput)) {
    throw new Error("DUPLICATE_TASK");
  }
  return addTask(store, date, safeInput, id);
}
