import { addTask, getTasksForDate } from "./task-store.js";

export function getPreviousDate(date) {
  assertValidDate(date);
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

export function getCarryoverCandidates(store, targetDate) {
  const sourceDate = getPreviousDate(targetDate);
  const sourceTasks = getTasksForDate(store, sourceDate).filter((task) => !task.completed);
  const targetTasks = getTasksForDate(store, targetDate);

  return sourceTasks
    .filter((sourceTask) => !targetTasks.some((targetTask) => hasSameContent(targetTask, sourceTask)))
    .map((task) => ({ ...task, sourceDate }));
}

export function carryOverTasks(store, targetDate, sourceTaskIds, idFactory) {
  if (!Array.isArray(sourceTaskIds) || sourceTaskIds.length === 0) {
    throw new Error("NO_TASK_SELECTED");
  }
  if (typeof idFactory !== "function") throw new Error("ID_FACTORY_REQUIRED");

  const selectedIds = new Set(sourceTaskIds);
  const candidates = getCarryoverCandidates(store, targetDate);
  const availableIds = new Set(candidates.map((task) => task.id));

  for (const taskId of selectedIds) {
    if (!availableIds.has(taskId)) throw new Error("TASK_NOT_AVAILABLE");
  }

  let nextStore = store;
  let index = 0;
  for (const task of candidates) {
    if (!selectedIds.has(task.id)) continue;
    nextStore = addTask(nextStore, targetDate, {
      subject: task.subject,
      title: task.title,
      plannedMinutes: task.plannedMinutes,
    }, idFactory(task, index));
    index += 1;
  }

  return nextStore;
}

function hasSameContent(left, right) {
  return left.subject === right.subject
    && left.title === right.title
    && left.plannedMinutes === right.plannedMinutes;
}

function assertValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("INVALID_DATE");
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("INVALID_DATE");
  }
}
