import { cloneDrawing, emptyDrawing, parseSavedDrawing } from "./drawing-model.js?v=20260719-6";

export const NOTE_STORE_VERSION = 1;
export const NOTE_STORAGE_KEY = "study-canvas:free-note:v1";
const NOTE_DATE = "free-note";
const MAX_STROKES = 100000;

export function emptyNoteStore() {
  return { version: NOTE_STORE_VERSION, drawing: emptyDrawing(NOTE_DATE) };
}

export function loadNoteStore(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { store: emptyNoteStore(), recovered: false };
  }

  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== NOTE_STORE_VERSION || !value.drawing || !Array.isArray(value.drawing.strokes)) {
      return { store: emptyNoteStore(), recovered: true };
    }

    const sourceCount = value.drawing.strokes.length;
    const limitedDrawing = {
      ...value.drawing,
      date: NOTE_DATE,
      strokes: value.drawing.strokes.slice(0, MAX_STROKES),
    };
    const drawing = parseSavedDrawing(JSON.stringify(limitedDrawing), NOTE_DATE);
    drawing.date = NOTE_DATE;
    const recovered = sourceCount > MAX_STROKES || drawing.strokes.length !== Math.min(sourceCount, MAX_STROKES);
    return { store: { version: NOTE_STORE_VERSION, drawing }, recovered };
  } catch {
    return { store: emptyNoteStore(), recovered: true };
  }
}

export function getNoteDrawing(store) {
  const drawing = cloneDrawing(store?.drawing || emptyDrawing(NOTE_DATE));
  drawing.date = NOTE_DATE;
  return drawing;
}

export function setNoteDrawing(store, drawing) {
  const nextDrawing = cloneDrawing(drawing || emptyDrawing(NOTE_DATE));
  nextDrawing.date = NOTE_DATE;
  return { version: NOTE_STORE_VERSION, drawing: nextDrawing };
}

export function serializeNoteStore(store) {
  const candidate = {
    version: NOTE_STORE_VERSION,
    drawing: getNoteDrawing(store),
  };
  const loaded = loadNoteStore(JSON.stringify(candidate));
  if (loaded.recovered) throw new Error("自由ノートのデータ形式が正しくありません");
  return JSON.stringify(loaded.store);
}

export function replaceStoredNoteStore(storage, key, nextStore) {
  const nextRaw = serializeNoteStore(nextStore);
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
