export const SCHEDULE_STORAGE_KEY = "study-canvas:schedule:v1";
export const SCHEDULE_STORE_VERSION = 1;

const MAX_DAYS = 1500;
const MAX_STROKES = 5000;
const MAX_POINTS = 20000;

export function emptyScheduleStore() {
  return { version: SCHEDULE_STORE_VERSION, days: {} };
}

export function loadScheduleStore(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return { store: emptyScheduleStore(), recovered: false };
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== SCHEDULE_STORE_VERSION || !isObject(value.days)) {
      return { store: emptyScheduleStore(), recovered: true };
    }
    const days = {};
    let recovered = false;
    for (const [date, day] of Object.entries(value.days).slice(0, MAX_DAYS)) {
      if (!isDate(date) || !isObject(day)) { recovered = true; continue; }
      const drawing = normalizeDrawing(day.drawing, date);
      const placements = normalizePlacements(day.placements);
      if (drawing.recovered || placements.recovered) recovered = true;
      if (drawing.value.strokes.length || Object.keys(placements.value).length) {
        days[date] = { drawing: drawing.value, placements: placements.value };
      }
    }
    if (Object.keys(value.days).length > MAX_DAYS) recovered = true;
    return { store: { version: SCHEDULE_STORE_VERSION, days }, recovered };
  } catch {
    return { store: emptyScheduleStore(), recovered: true };
  }
}

export function serializeScheduleStore(store) {
  const loaded = loadScheduleStore(JSON.stringify(store));
  if (loaded.recovered) throw new TypeError("スケジュールデータの形式が正しくありません");
  return JSON.stringify(loaded.store);
}

export function getScheduleDay(store, date) {
  assertDate(date);
  const day = store.days[date];
  return day ? structuredClone(day) : { drawing: emptyDrawing(date), placements: {} };
}

export function setScheduleDrawing(store, date, drawing) {
  const normalized = normalizeDrawing(drawing, date);
  if (normalized.recovered) throw new TypeError("手書きデータの形式が正しくありません");
  return setDay(store, date, { ...getScheduleDay(store, date), drawing: normalized.value });
}

export function setSchedulePlacement(store, date, taskId, position) {
  const id = validateId(taskId);
  const x = Number(position?.x);
  const y = Number(position?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError("カード位置が正しくありません");
  const day = getScheduleDay(store, date);
  day.placements[id] = { x: clamp(x, 0, 0.76), y: clamp(y, 0, 0.925) };
  return setDay(store, date, day);
}

export function removeSchedulePlacement(store, date, taskId) {
  const day = getScheduleDay(store, date);
  delete day.placements[validateId(taskId)];
  return setDay(store, date, day);
}

export function replaceStoredScheduleStore(storage, nextStore) {
  const nextRaw = serializeScheduleStore(nextStore);
  const previousRaw = storage.getItem(SCHEDULE_STORAGE_KEY);
  try {
    storage.setItem(SCHEDULE_STORAGE_KEY, nextRaw);
    if (storage.getItem(SCHEDULE_STORAGE_KEY) !== nextRaw) throw new Error("保存結果を確認できませんでした");
  } catch (error) {
    if (previousRaw === null) storage.removeItem(SCHEDULE_STORAGE_KEY);
    else storage.setItem(SCHEDULE_STORAGE_KEY, previousRaw);
    throw error;
  }
  return nextRaw;
}

function setDay(store, date, day) {
  assertDate(date);
  const days = { ...store.days };
  if (!day.drawing.strokes.length && !Object.keys(day.placements).length) delete days[date];
  else days[date] = structuredClone(day);
  return { version: SCHEDULE_STORE_VERSION, days };
}

function emptyDrawing(date) { return { version: 1, date, strokes: [] }; }

function normalizeDrawing(value, date) {
  if (!value) return { value: emptyDrawing(date), recovered: false };
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.strokes)) {
    return { value: emptyDrawing(date), recovered: true };
  }
  let recovered = value.strokes.length > MAX_STROKES;
  const strokes = [];
  for (const stroke of value.strokes.slice(0, MAX_STROKES)) {
    if (!isObject(stroke) || !Array.isArray(stroke.points) || !stroke.points.length || stroke.points.length > MAX_POINTS ||
      typeof stroke.color !== "string" || !Number.isFinite(Number(stroke.width)) || Number(stroke.width) <= 0) {
      recovered = true; continue;
    }
    const points = stroke.points.map((point) => ({ x: Number(point?.x), y: Number(point?.y) }));
    if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) {
      recovered = true; continue;
    }
    strokes.push({ id: validateId(String(stroke.id)), color: stroke.color, width: Number(stroke.width), points });
  }
  return { value: { version: 1, date, strokes }, recovered };
}

function normalizePlacements(value) {
  if (value === undefined) return { value: {}, recovered: false };
  if (!isObject(value)) return { value: {}, recovered: true };
  const placements = {};
  let recovered = false;
  for (const [id, position] of Object.entries(value)) {
    try {
      const x = Number(position?.x); const y = Number(position?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error();
      placements[validateId(id)] = { x: clamp(x, 0, 0.76), y: clamp(y, 0, 0.925) };
    } catch { recovered = true; }
  }
  return { value: placements, recovered };
}

function validateId(id) {
  if (typeof id !== "string" || !id.trim() || id.length > 100) throw new TypeError("IDが正しくありません");
  return id;
}
function isDate(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T00:00:00Z`).getTime()); }
function assertDate(date) { if (!isDate(date)) throw new TypeError("日付が正しくありません"); }
function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
