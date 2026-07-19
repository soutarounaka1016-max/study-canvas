import { cloneDrawing, emptyDrawing, parseSavedDrawing } from "./drawing-model.js?v=20260720-1";

export const NOTE_STORE_VERSION = 1;

export function emptyNoteStore() {
  return { version: NOTE_STORE_VERSION, order: [], notes: {} };
}

export function parseNoteStore(raw) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== NOTE_STORE_VERSION || !Array.isArray(value.order) || !value.notes || typeof value.notes !== "object") return null;
    const notes = {};
    for (const id of value.order) {
      const note = value.notes[id];
      if (typeof id !== "string" || !note || typeof note.title !== "string") continue;
      notes[id] = {
        id,
        title: note.title.trim().slice(0, 80) || "無題のノート",
        createdAt: validTimestamp(note.createdAt),
        drawing: cloneDrawing(parseSavedDrawing(JSON.stringify(note.drawing), "")),
      };
    }
    return { version: NOTE_STORE_VERSION, order: Object.keys(notes), notes };
  } catch {
    return null;
  }
}

export function serializeNoteStore(store) {
  return JSON.stringify(parseNoteStore(JSON.stringify(store)) || emptyNoteStore());
}

export function createNote(store, id, title, createdAt = new Date().toISOString()) {
  if (typeof id !== "string" || !id || typeof title !== "string" || !title.trim()) throw new TypeError("ノート名が正しくありません");
  const current = parseNoteStore(JSON.stringify(store)) || emptyNoteStore();
  const note = {
    id,
    title: title.trim().slice(0, 80),
    createdAt: validTimestamp(createdAt),
    drawing: emptyDrawing(""),
  };
  return {
    version: NOTE_STORE_VERSION,
    order: [id, ...current.order.filter((noteId) => noteId !== id)],
    notes: { ...current.notes, [id]: note },
  };
}

export function getNote(store, id) {
  const note = store?.notes?.[id];
  return note ? structuredClone(note) : null;
}

export function setNoteDrawing(store, id, drawing) {
  const note = getNote(store, id);
  if (!note) throw new TypeError("ノートが見つかりません");
  return {
    version: NOTE_STORE_VERSION,
    order: [...store.order],
    notes: { ...store.notes, [id]: { ...note, drawing: cloneDrawing(drawing) } },
  };
}

export function listNotes(store) {
  return (store?.order || []).map((id) => getNote(store, id)).filter(Boolean);
}

function validTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}
