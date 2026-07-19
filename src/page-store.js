import { cloneDrawing, emptyDrawing, parseSavedDrawing } from "./drawing-model.js?v=20260719-1";

export const PAGE_STORE_VERSION = 2;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function emptyPageStore() {
  return { version: PAGE_STORE_VERSION, pages: {} };
}

export function loadPageStore(rawStore, rawLegacyDrawing, today) {
  const parsedStore = parsePageStore(rawStore);
  if (parsedStore) return { store: parsedStore, migrated: false, recovered: false };

  const legacyDrawing = parseLegacyDrawing(rawLegacyDrawing, today);
  if (legacyDrawing) {
    return {
      store: setPageDrawing(emptyPageStore(), today, legacyDrawing),
      migrated: true,
      recovered: Boolean(rawStore),
    };
  }

  return {
    store: emptyPageStore(),
    migrated: false,
    recovered: Boolean(rawStore || rawLegacyDrawing),
  };
}

export function getPageDrawing(store, date) {
  if (!isValidDateKey(date)) return emptyDrawing("");
  const drawing = store?.pages?.[date];
  return drawing ? withDate(drawing, date) : emptyDrawing(date);
}

export function setPageDrawing(store, date, drawing) {
  if (!isValidDateKey(date)) throw new TypeError("日付が正しくありません");
  return {
    version: PAGE_STORE_VERSION,
    pages: {
      ...(store?.pages || {}),
      [date]: withDate(drawing, date),
    },
  };
}

export function listWrittenPageDates(store) {
  return Object.entries(store?.pages || {})
    .filter(([date, drawing]) => isValidDateKey(date) && drawing?.strokes?.length > 0)
    .map(([date]) => date)
    .sort((first, second) => second.localeCompare(first));
}

export function shiftDate(date, amount) {
  if (!isValidDateKey(date) || !Number.isInteger(amount)) throw new TypeError("日付が正しくありません");
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + amount);
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function serializePageStore(store) {
  return JSON.stringify(parsePageStore(JSON.stringify(store)) || emptyPageStore());
}

function parsePageStore(raw) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== PAGE_STORE_VERSION || !value.pages || typeof value.pages !== "object") return null;

    const pages = {};
    for (const [date, drawing] of Object.entries(value.pages)) {
      if (!isValidDateKey(date)) continue;
      const parsedDrawing = parseSavedDrawing(JSON.stringify(drawing), date);
      pages[date] = withDate(parsedDrawing, date);
    }
    return { version: PAGE_STORE_VERSION, pages };
  } catch {
    return null;
  }
}

function parseLegacyDrawing(raw, today) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Array.isArray(value.strokes)) return null;
    return withDate(parseSavedDrawing(raw, today), today);
  } catch {
    return null;
  }
}

function withDate(drawing, date) {
  const copy = cloneDrawing(drawing || emptyDrawing(date));
  copy.date = date;
  return copy;
}

function isValidDateKey(value) {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}
