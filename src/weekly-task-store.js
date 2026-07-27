export const WEEKLY_TASK_STORAGE_KEY = "study-canvas:weekly-tasks:v1";
export const WEEKLY_TASK_STORE_VERSION = 1;
const SUBJECTS = ["数学", "英語", "物理", "化学", "その他"];
const MAX_TASKS_PER_SUBJECT = 100;
const MAX_TEXT_LENGTH = 160;

export function emptyWeeklyTaskStore() {
  return { version: WEEKLY_TASK_STORE_VERSION, tasksByWeek: {} };
}

export function loadWeeklyTaskStore(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return { store: emptyWeeklyTaskStore(), recovered: false };
  try {
    const value = JSON.parse(raw);
    if (value?.version !== WEEKLY_TASK_STORE_VERSION || !isPlainObject(value.tasksByWeek)) {
      return { store: emptyWeeklyTaskStore(), recovered: true };
    }
    const tasksByWeek = {};
    let recovered = false;
    for (const [weekStart, bySubject] of Object.entries(value.tasksByWeek)) {
      if (!isMonday(weekStart) || !isPlainObject(bySubject)) {
        recovered = true;
        continue;
      }
      const safeSubjects = {};
      for (const subject of SUBJECTS) {
        const tasks = bySubject[subject];
        if (tasks === undefined) continue;
        if (!Array.isArray(tasks)) {
          recovered = true;
          continue;
        }
        const ids = new Set();
        const safe = [];
        for (const task of tasks.slice(0, MAX_TASKS_PER_SUBJECT)) {
          const normalized = normalizeTask(task);
          if (!normalized || ids.has(normalized.id)) {
            recovered = true;
            continue;
          }
          ids.add(normalized.id);
          safe.push(normalized);
        }
        if (tasks.length > MAX_TASKS_PER_SUBJECT) recovered = true;
        if (safe.length > 0) safeSubjects[subject] = safe;
      }
      if (Object.keys(safeSubjects).length > 0) tasksByWeek[weekStart] = safeSubjects;
    }
    return { store: { version: WEEKLY_TASK_STORE_VERSION, tasksByWeek }, recovered };
  } catch {
    return { store: emptyWeeklyTaskStore(), recovered: true };
  }
}

export function serializeWeeklyTaskStore(store) {
  const loaded = loadWeeklyTaskStore(JSON.stringify(store));
  if (loaded.recovered) throw new Error("週間カードデータの形式が正しくありません");
  return JSON.stringify(loaded.store);
}

export function getWeeklyTasks(store, weekStart, subject) {
  assertWeekAndSubject(weekStart, subject);
  return (store?.tasksByWeek?.[weekStart]?.[subject] || []).map((task) => ({ ...task }));
}

export function addWeeklyTasks(store, weekStart, subject, texts, createId = defaultId, now = new Date()) {
  assertWeekAndSubject(weekStart, subject);
  if (!Array.isArray(texts)) throw new Error("保存する候補が正しくありません");
  const normalizedTexts = texts.map(normalizeText).filter(Boolean);
  if (normalizedTexts.length === 0) throw new Error("保存する候補を選んでください");
  const current = getWeeklyTasks(store, weekStart, subject);
  if (current.length + normalizedTexts.length > MAX_TASKS_PER_SUBJECT) throw new Error("この科目の週間カードはこれ以上追加できません");
  const createdAt = new Date(now).toISOString();
  if (createdAt === "Invalid Date") throw new Error("保存日時が正しくありません");
  const nextTasks = [...current];
  for (const text of normalizedTexts) {
    const id = String(createId()).trim();
    if (!id || id.length > 100 || nextTasks.some((task) => task.id === id)) throw new Error("週間カードIDが正しくありません");
    nextTasks.push({ id, text, createdAt, source: "workers-ai" });
  }
  return setTasks(store, weekStart, subject, nextTasks);
}

export function replaceStoredWeeklyTaskStore(storage, nextStore) {
  const nextRaw = serializeWeeklyTaskStore(nextStore);
  const previousRaw = storage.getItem(WEEKLY_TASK_STORAGE_KEY);
  try {
    storage.setItem(WEEKLY_TASK_STORAGE_KEY, nextRaw);
    if (storage.getItem(WEEKLY_TASK_STORAGE_KEY) !== nextRaw) throw new Error("保存結果を確認できませんでした");
    return nextRaw;
  } catch (error) {
    try {
      if (previousRaw === null) storage.removeItem(WEEKLY_TASK_STORAGE_KEY);
      else storage.setItem(WEEKLY_TASK_STORAGE_KEY, previousRaw);
    } catch {
      // 最初の保存エラーを優先する。
    }
    throw error;
  }
}

function setTasks(store, weekStart, subject, tasks) {
  return {
    version: WEEKLY_TASK_STORE_VERSION,
    tasksByWeek: {
      ...(store?.tasksByWeek || {}),
      [weekStart]: {
        ...(store?.tasksByWeek?.[weekStart] || {}),
        [subject]: tasks.map((task) => ({ ...task })),
      },
    },
  };
}

function normalizeTask(value) {
  if (!isPlainObject(value) || value.source !== "workers-ai") return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const text = normalizeText(value.text);
  const createdAt = new Date(value.createdAt);
  if (!id || id.length > 100 || !text || Number.isNaN(createdAt.getTime())) return null;
  return { id, text, createdAt: createdAt.toISOString(), source: "workers-ai" };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_TEXT_LENGTH) : "";
}

function assertWeekAndSubject(weekStart, subject) {
  if (!isMonday(weekStart)) throw new Error("週の開始日が正しくありません");
  if (!SUBJECTS.includes(subject)) throw new Error("科目が正しくありません");
}

function isMonday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}

function defaultId() {
  return globalThis.crypto?.randomUUID?.() || `weekly-task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
