import { cloneDrawing, emptyDrawing, parseSavedDrawing } from "./drawing-model.js?v=20260719-6";

export const NOTE_STORE_VERSION = 2;
export const NOTE_STORAGE_KEY = "study-canvas:free-note:v1";
const MAX_STROKES = 100000;

export function emptyNoteStore() {
  const page = createPage("note-1", "ノート 1");
  return { version: NOTE_STORE_VERSION, activePageId: page.id, pages: [page] };
}

export function loadNoteStore(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { store: emptyNoteStore(), recovered: false, migrated: false };
  }

  try {
    const value = JSON.parse(raw);
    if (value?.version === 1 && value.drawing && Array.isArray(value.drawing.strokes)) {
      const page = createPage("note-1", "ノート 1", sanitizeDrawing(value.drawing, "note-1"));
      return {
        store: { version: NOTE_STORE_VERSION, activePageId: page.id, pages: [page] },
        recovered: page.drawing.strokes.length !== Math.min(value.drawing.strokes.length, MAX_STROKES),
        migrated: true,
      };
    }

    if (value?.version !== NOTE_STORE_VERSION || !Array.isArray(value.pages)) {
      return { store: emptyNoteStore(), recovered: true, migrated: false };
    }

    let recovered = false;
    const pages = [];
    const seen = new Set();
    for (const [index, source] of value.pages.entries()) {
      if (!source || typeof source !== "object") {
        recovered = true;
        continue;
      }
      const id = normalizeId(source.id, index, seen);
      const title = normalizeTitle(source.title, pages.length + 1);
      const sourceStrokeCount = Array.isArray(source.drawing?.strokes) ? source.drawing.strokes.length : 0;
      const drawing = sanitizeDrawing(source.drawing, id);
      if (!Array.isArray(source.drawing?.strokes) || drawing.strokes.length !== Math.min(sourceStrokeCount, MAX_STROKES)) recovered = true;
      pages.push(createPage(id, title, drawing, source.createdAt, source.updatedAt));
      seen.add(id);
    }

    if (pages.length === 0) {
      return { store: emptyNoteStore(), recovered: true, migrated: false };
    }

    const activePageId = pages.some((page) => page.id === value.activePageId)
      ? value.activePageId
      : pages[0].id;
    if (activePageId !== value.activePageId) recovered = true;
    return { store: { version: NOTE_STORE_VERSION, activePageId, pages }, recovered, migrated: false };
  } catch {
    return { store: emptyNoteStore(), recovered: true, migrated: false };
  }
}

export function listNotePages(store) {
  return normalizeStore(store).pages.map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt }));
}

export function getNoteDrawing(store, pageId = store?.activePageId) {
  const normalized = normalizeStore(store);
  const page = normalized.pages.find((item) => item.id === pageId) || normalized.pages[0];
  const drawing = cloneDrawing(page.drawing);
  drawing.date = page.id;
  return drawing;
}

export function setNoteDrawing(store, drawing, pageId = store?.activePageId) {
  const normalized = normalizeStore(store);
  const targetId = normalized.pages.some((page) => page.id === pageId) ? pageId : normalized.activePageId;
  const pages = normalized.pages.map((page) => page.id === targetId
    ? { ...page, drawing: sanitizeDrawing(drawing, targetId), updatedAt: new Date().toISOString() }
    : page);
  return { version: NOTE_STORE_VERSION, activePageId: targetId, pages };
}

export function setActiveNotePage(store, pageId) {
  const normalized = normalizeStore(store);
  if (!normalized.pages.some((page) => page.id === pageId)) throw new TypeError("自由ノートのページが見つかりません");
  return { ...normalized, activePageId: pageId };
}

export function addNotePage(store) {
  const normalized = normalizeStore(store);
  const nextNumber = getNextNumber(normalized.pages);
  const page = createPage(createUniqueId(normalized.pages), `ノート ${nextNumber}`);
  return { version: NOTE_STORE_VERSION, activePageId: page.id, pages: [...normalized.pages, page] };
}

export function renameNotePage(store, pageId, title) {
  const normalized = normalizeStore(store);
  const pageIndex = normalized.pages.findIndex((page) => page.id === pageId);
  if (pageIndex < 0) throw new TypeError("自由ノートのページが見つかりません");
  const nextTitle = normalizeTitle(title, pageIndex + 1);
  if (normalized.pages[pageIndex].title === nextTitle) return normalized;
  const pages = normalized.pages.map((page, index) => index === pageIndex
    ? { ...page, title: nextTitle, updatedAt: new Date().toISOString() }
    : page);
  return { ...normalized, pages };
}

export function deleteNotePage(store, pageId = store?.activePageId) {
  const normalized = normalizeStore(store);
  if (normalized.pages.length <= 1) return normalized;
  const pages = normalized.pages.filter((page) => page.id !== pageId);
  if (pages.length === normalized.pages.length) return normalized;
  const activePageId = normalized.activePageId === pageId ? pages[0].id : normalized.activePageId;
  return { version: NOTE_STORE_VERSION, activePageId, pages };
}

export function serializeNoteStore(store) {
  const normalized = normalizeStore(store);
  const loaded = loadNoteStore(JSON.stringify(normalized));
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
      // 最初の保存エラーを優先する。
    }
    throw error;
  }
}

function normalizeStore(store) {
  if (store?.version === NOTE_STORE_VERSION && Array.isArray(store.pages) && store.pages.length > 0) {
    return {
      version: NOTE_STORE_VERSION,
      activePageId: store.pages.some((page) => page.id === store.activePageId) ? store.activePageId : store.pages[0].id,
      pages: store.pages.map((page, index) => createPage(
        String(page.id || `note-${index + 1}`),
        normalizeTitle(page.title, index + 1),
        sanitizeDrawing(page.drawing, String(page.id || `note-${index + 1}`)),
        page.createdAt,
        page.updatedAt,
      )),
    };
  }
  return emptyNoteStore();
}

function createPage(id, title, drawing = emptyDrawing(id), createdAt, updatedAt) {
  const now = new Date().toISOString();
  return {
    id,
    title,
    createdAt: typeof createdAt === "string" ? createdAt : now,
    updatedAt: typeof updatedAt === "string" ? updatedAt : now,
    drawing: sanitizeDrawing(drawing, id),
  };
}

function sanitizeDrawing(value, id) {
  const source = value && Array.isArray(value.strokes)
    ? { ...value, date: id, strokes: value.strokes.slice(0, MAX_STROKES) }
    : emptyDrawing(id);
  const drawing = parseSavedDrawing(JSON.stringify(source), id);
  drawing.date = id;
  return drawing;
}

function normalizeId(value, index, seen) {
  let id = typeof value === "string" && value.trim() ? value.trim() : `note-${index + 1}`;
  while (seen.has(id)) id = `${id}-${index + 1}`;
  return id;
}

function normalizeTitle(value, index) {
  const title = typeof value === "string" ? value.trim().slice(0, 40) : "";
  return title || `ノート ${index}`;
}

function createUniqueId(pages) {
  const ids = new Set(pages.map((page) => page.id));
  let id = globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  while (ids.has(id)) id = `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return id;
}

function getNextNumber(pages) {
  const used = new Set(pages.map((page) => Number(/^ノート\s+(\d+)$/.exec(page.title)?.[1])).filter(Number.isInteger));
  let number = 1;
  while (used.has(number)) number += 1;
  return number;
}
