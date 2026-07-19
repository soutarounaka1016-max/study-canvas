export const TASK_STORE_VERSION = 1;

export function emptyTaskStore() {
  return { version: TASK_STORE_VERSION, tasksByDate: {} };
}

export function parseTaskStore(raw) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== TASK_STORE_VERSION || !value.tasksByDate || typeof value.tasksByDate !== "object") return null;
    const tasksByDate = {};
    for (const [date, tasks] of Object.entries(value.tasksByDate)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(tasks)) continue;
      tasksByDate[date] = tasks.map(normalizeTask).filter(Boolean);
    }
    return { version: TASK_STORE_VERSION, tasksByDate };
  } catch {
    return null;
  }
}

export function serializeTaskStore(store) {
  return JSON.stringify(parseTaskStore(JSON.stringify(store)) || emptyTaskStore());
}

export function getTasksForDate(store, date) {
  return structuredClone(store?.tasksByDate?.[date] || []);
}

export function setTasksForDate(store, date, tasks) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(tasks)) throw new TypeError("タスクの日付が正しくありません");
  return {
    version: TASK_STORE_VERSION,
    tasksByDate: {
      ...(store?.tasksByDate || {}),
      [date]: tasks.map(normalizeTask).filter(Boolean),
    },
  };
}

export function addTask(store, date, task) {
  return setTasksForDate(store, date, [...getTasksForDate(store, date), task]);
}

export function updateTask(store, date, taskId, changes) {
  return setTasksForDate(store, date, getTasksForDate(store, date).map((task) =>
    task.id === taskId ? { ...task, ...changes, id: task.id } : task));
}

export function deleteTask(store, date, taskId) {
  return setTasksForDate(store, date, getTasksForDate(store, date).filter((task) => task.id !== taskId));
}

function normalizeTask(task) {
  if (!task || typeof task.id !== "string" || typeof task.title !== "string") return null;
  const title = task.title.trim().slice(0, 120);
  if (!title) return null;
  return {
    id: task.id.slice(0, 120),
    subject: typeof task.subject === "string" ? task.subject.trim().slice(0, 40) : "",
    title,
    minutes: Math.max(1, Math.min(600, Math.round(Number(task.minutes) || 1))),
    completed: Boolean(task.completed),
    x: Math.max(0, Math.min(1200, Number(task.x) || 0)),
    y: Math.max(0, Math.min(840, Number(task.y) || 0)),
  };
}
