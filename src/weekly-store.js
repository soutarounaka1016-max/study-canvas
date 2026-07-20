import {
  emptyPageStore,
  getPageDrawing,
  loadPageStore,
  serializePageStore,
  setPageDrawing,
  shiftDate,
} from "./page-store.js?v=20260719-6";

export const WEEKLY_STORAGE_KEY = "study-canvas:weekly:v1";
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

export function loadWeeklyStore(raw, currentDate) {
  const currentWeekStart = getWeekStart(currentDate);
  const loaded = loadPageStore(raw, null, currentWeekStart);
  const pages = {};
  let recovered = loaded.recovered;
  let count = 0;

  for (const [date, drawing] of Object.entries(loaded.store.pages || {})) {
    if (date !== getWeekStart(date) || count >= MAX_WEEKS) {
      recovered = true;
      continue;
    }
    pages[date] = getPageDrawing(loaded.store, date);
    count += 1;
  }

  return { store: { ...emptyPageStore(), pages }, recovered };
}

export function getWeeklyDrawing(store, weekStart) {
  return getPageDrawing(store, getWeekStart(weekStart));
}

export function setWeeklyDrawing(store, weekStart, drawing) {
  return setPageDrawing(store, getWeekStart(weekStart), drawing);
}

export function serializeWeeklyStore(store) {
  return serializePageStore(store);
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
