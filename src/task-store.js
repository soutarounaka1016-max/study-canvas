export const TASK_STORE_VERSION = 1;
export const TASK_STORAGE_KEY = "study-canvas:tasks:v1";
export const TASK_SUBJECTS = ["数学", "英語", "物理", "化学", "国語", "その他"];

const MAX_TASKS_PER_DATE = 200;
const MAX_TITLE_LENGTH = 120;
const MIN_PLANNED_MINUTES = 5;
const MAX_PLANNED_MINUTES = 600;

export function emptyTaskStore() {
  return { version: TASK_STORE_VERSION, tasksByDate: {} };
}

export function loadTaskStore(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { store: emptyTaskStore(), recovered: false };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== TASK_STORE_VERSION || !isPlainObject(parsed.tasksByDate)) {
      return { store: emptyTaskStore(), recovered: true };
    }

    const tasksByDate = {};
    let recovered = false;

    for (const [date, tasks] of Object.entries(parsed.tasksByDate)) {
      if (!isValidDate(date) || !Array.isArray(tasks)) {
        recovered = true;
        continue;
      }

      const normalized = [];
      const ids = new Set();
      for (const task of tasks.slice(0, MAX_TASKS_PER_DATE)) {
        const safeTask = normalizeStoredTask(task);
        if (!safeTask || ids.has(safeTask.id)) {
          recovered = true;
          continue;
        }
        ids.add(safeTask.id);
        normalized.push(safeTask);
      }
      if (tasks.length > MAX_TASKS_PER_DATE) recovered = true;
      if (normalized.length > 0) tasksByDate[date] = normalized;
    }

    return { store: { version: TASK_STORE_VERSION, tasksByDate }, recovered };
  } catch {
    return { store: emptyTaskStore(), recovered: true };
  }
}

export function serializeTaskStore(store) {
  const canonical = loadTaskStore(JSON.stringify(store));
  if (canonical.recovered) throw new Error("タスクデータの形式が正しくありません");
  return JSON.stringify(canonical.store);
}

export function getTasksForDate(store, date) {
  assertValidDate(date);
  return (store.tasksByDate[date] || []).map((task) => ({ ...task }));
}

export function validateTaskInput(input) {
  const subject = typeof input?.subject === "string" ? input.subject.trim() : "";
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const plannedMinutes = Number(input?.plannedMinutes);

  if (!TASK_SUBJECTS.includes(subject)) throw new Error("科目を選んでください");
  if (!title) throw new Error("勉強内容を入力してください");
  if (title.length > MAX_TITLE_LENGTH) throw new Error(`勉強内容は${MAX_TITLE_LENGTH}文字以内にしてください`);
  if (!Number.isInteger(plannedMinutes) || plannedMinutes < MIN_PLANNED_MINUTES || plannedMinutes > MAX_PLANNED_MINUTES) {
    throw new Error(`予定時間は${MIN_PLANNED_MINUTES}〜${MAX_PLANNED_MINUTES}分で入力してください`);
  }

  return { subject, title, plannedMinutes };
}

export function addTask(store, date, input, id) {
  assertValidDate(date);
  const safeInput = validateTaskInput(input);
  const safeId = validateId(id);
  const current = getTasksForDate(store, date);
  if (current.length >= MAX_TASKS_PER_DATE) throw new Error("この日のタスクはこれ以上追加できません");
  if (current.some((task) => task.id === safeId)) throw new Error("同じIDのタスクがあります");

  return setTasksForDate(store, date, [
    ...current,
    { id: safeId, ...safeInput, completed: false },
  ]);
}

export function updateTask(store, date, taskId, input) {
  const safeInput = validateTaskInput(input);
  return changeTask(store, date, taskId, (task) => ({ ...task, ...safeInput }));
}

export function toggleTask(store, date, taskId) {
  return changeTask(store, date, taskId, (task) => ({ ...task, completed: !task.completed }));
}

export function deleteTask(store, date, taskId) {
  assertValidDate(date);
  const safeId = validateId(taskId);
  const current = getTasksForDate(store, date);
  const next = current.filter((task) => task.id !== safeId);
  if (next.length === current.length) throw new Error("削除するタスクが見つかりません");
  return setTasksForDate(store, date, next);
}

export function replaceStoredTaskStore(storage, key, nextStore) {
  const nextRaw = serializeTaskStore(nextStore);
  const previousRaw = storage.getItem(key);

  try {
    storage.setItem(key, nextRaw);
    if (storage.getItem(key) !== nextRaw) throw new Error("保存結果を確認できませんでした");
    return nextRaw;
  } catch (error) {
    try {
      if (previousRaw === null) storage.removeItem(key);
      else storage.setItem(key, previousRaw);
    } catch {
      // 元データの復帰にも失敗した場合でも、最初の保存エラーを報告する。
    }
    throw error;
  }
}

function changeTask(store, date, taskId, change) {
  assertValidDate(date);
  const safeId = validateId(taskId);
  const current = getTasksForDate(store, date);
  let found = false;
  const next = current.map((task) => {
    if (task.id !== safeId) return task;
    found = true;
    return change(task);
  });
  if (!found) throw new Error("変更するタスクが見つかりません");
  return setTasksForDate(store, date, next);
}

function setTasksForDate(store, date, tasks) {
  const tasksByDate = { ...store.tasksByDate };
  if (tasks.length === 0) delete tasksByDate[date];
  else tasksByDate[date] = tasks.map((task) => ({ ...task }));
  return { version: TASK_STORE_VERSION, tasksByDate };
}

function normalizeStoredTask(task) {
  if (!isPlainObject(task) || typeof task.completed !== "boolean") return null;
  try {
    return {
      id: validateId(task.id),
      ...validateTaskInput(task),
      completed: task.completed,
    };
  } catch {
    return null;
  }
}

function validateId(id) {
  if (typeof id !== "string" || id.trim() === "" || id.length > 100) {
    throw new Error("タスクIDが正しくありません");
  }
  return id;
}

function assertValidDate(date) {
  if (!isValidDate(date)) throw new Error("日付が正しくありません");
}

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
