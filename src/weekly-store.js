import { cloneDrawing, emptyDrawing, parseSavedDrawing } from "./drawing-model.js?v=20260719-6";
import { shiftDate } from "./page-store.js?v=20260719-6";

export const WEEKLY_STORAGE_KEY = "study-canvas:weekly:v1";
export const WEEKLY_STORE_VERSION = 2;
export const WEEKLY_SUBJECTS = ["数学", "英語", "物理", "化学", "その他"];
const DEFAULT_SUBJECT = "その他";
const MAX_WEEKS = 520;

export function getWeekStart(date) {
  const valid = shiftDate(date, 0);
  const [year, month, day] = valid.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (value.getUTCDay() + 6) % 7;
  return shiftDate(valid, -mondayOffset);
}

export function getWeekEnd(weekStart) {
  return shiftDate(getWeekStart(weekStart), 6);
}

export function shiftWeek(weekStart, amount) {
  if (!Number.isInteger(amount)) throw new TypeError("週の移動量が正しくありません");
  return shiftDate(getWeekStart(weekStart), amount * 7);
}

export function emptyWeeklyStore() {
  return { version: WEEKLY_STORE_VERSION, weeks: {} };
}

export function loadWeeklyStore(raw, currentDate) {
  const currentWeekStart = getWeekStart(currentDate);
  if (!raw) return { store: emptyWeeklyStore(), recovered: false, migrated: false };

  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return { store: emptyWeeklyStore(), recovered: true, migrated: false };
  }

  if (value?.version === WEEKLY_STORE_VERSION && value.weeks && typeof value.weeks === "object" && !Array.isArray(value.weeks)) {
    const parsed = parseSubjectStore(value);
    return { store: parsed.store, recovered: parsed.recovered, migrated: false };
  }

  // 旧形式は「1週間につき1枚」のページストア。内容を失わないよう「その他」へ移す。
  if (value?.version === 2 && value.pages && typeof value.pages === "object" && !Array.isArray(value.pages)) {
    const weeks = {};
    let recovered = false;
    let count = 0;
    for (const [date, drawing] of Object.entries(value.pages)) {
      if (count >= MAX_WEEKS || !isWeekStart(date)) {
        recovered = true;
        continue;
      }
      const parsed = parseDrawing(drawing, date);
      if (!parsed) {
        recovered = true;
        continue;
      }
      weeks[date] = { subjects: { [DEFAULT_SUBJECT]: parsed } };
      count += 1;
    }
    return { store: { version: WEEKLY_STORE_VERSION, weeks }, recovered, migrated: true };
  }

  return { store: emptyWeeklyStore(), recovered: true, migrated: false, currentWeekStart };
}

export function getWeeklyDrawing(store, weekStart, subject = DEFAULT_SUBJECT) {
  const week = getWeekStart(weekStart);
  const normalizedSubject = normalizeSubject(subject);
  const drawing = store?.weeks?.[week]?.subjects?.[normalizedSubject];
  return drawing ? withDate(drawing, week) : emptyDrawing(week);
}

export function setWeeklyDrawing(store, weekStart, subject, drawing) {
  const week = getWeekStart(weekStart);
  const normalizedSubject = normalizeSubject(subject);
  const currentWeek = store?.weeks?.[week] || { subjects: {} };
  return {
    version: WEEKLY_STORE_VERSION,
    weeks: {
      ...(store?.weeks || {}),
      [week]: {
        subjects: {
          ...(currentWeek.subjects || {}),
          [normalizedSubject]: withDate(drawing, week),
        },
      },
    },
  };
}

export function serializeWeeklyStore(store) {
  return JSON.stringify(parseSubjectStore(store).store);
}

export function replaceStoredWeeklyStore(storage, key, nextStore) {
  const nextRaw = serializeWeeklyStore(nextStore);
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

export function listWeeklyDrawings(store) {
  const result = [];
  for (const [weekStart, week] of Object.entries(store?.weeks || {})) {
    for (const subject of WEEKLY_SUBJECTS) {
      const drawing = week?.subjects?.[subject];
      if (drawing?.strokes?.length > 0) result.push({ weekStart, subject, drawing: cloneDrawing(drawing) });
    }
  }
  return result;
}

function parseSubjectStore(value) {
  const weeks = {};
  let recovered = false;
  let count = 0;
  for (const [weekStart, week] of Object.entries(value?.weeks || {})) {
    if (count >= MAX_WEEKS || !isWeekStart(weekStart) || !week?.subjects || typeof week.subjects !== "object") {
      recovered = true;
      continue;
    }
    const subjects = {};
    for (const subject of WEEKLY_SUBJECTS) {
      if (!(subject in week.subjects)) continue;
      const parsed = parseDrawing(week.subjects[subject], weekStart);
      if (!parsed) recovered = true;
      else subjects[subject] = parsed;
    }
    weeks[weekStart] = { subjects };
    count += 1;
  }
  return { store: { version: WEEKLY_STORE_VERSION, weeks }, recovered };
}

function parseDrawing(value, date) {
  try {
    return withDate(parseSavedDrawing(JSON.stringify(value), date), date);
  } catch {
    return null;
  }
}

function withDate(drawing, date) {
  const copy = cloneDrawing(drawing || emptyDrawing(date));
  copy.date = date;
  return copy;
}

function normalizeSubject(subject) {
  return WEEKLY_SUBJECTS.includes(subject) ? subject : DEFAULT_SUBJECT;
}

function isWeekStart(value) {
  try {
    return value === getWeekStart(value);
  } catch {
    return false;
  }
}
