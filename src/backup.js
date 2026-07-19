import { emptyNoteStore, parseNoteStore, serializeNoteStore } from "./note-store.js?v=20260720-1";
import { emptyPageStore, parsePageStore, serializePageStore } from "./page-store.js?v=20260720-1";
import { emptyTaskStore, parseTaskStore, serializeTaskStore } from "./task-store.js?v=20260720-1";

export const BACKUP_FORMAT = "study-canvas-backup";
export const BACKUP_VERSION = 2;

export function createBackup(data, exportedAt = new Date()) {
  const timestamp = new Date(exportedAt);
  if (Number.isNaN(timestamp.getTime())) throw new TypeError("書き出し日時が正しくありません");
  const normalized = normalizeData(data);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: timestamp.toISOString(),
    data: normalized,
  };
}

export function serializeBackup(data, exportedAt = new Date()) {
  return `${JSON.stringify(createBackup(data, exportedAt), null, 2)}\n`;
}

export function parseBackup(raw) {
  try {
    const value = JSON.parse(raw);
    if (value?.format !== BACKUP_FORMAT || !Number.isFinite(Date.parse(value.exportedAt))) return null;

    if (value.version === 1) {
      const dailyPages = parsePageStore(JSON.stringify(value.pageStore));
      if (!dailyPages) return null;
      return {
        version: 1,
        exportedAt: new Date(value.exportedAt).toISOString(),
        data: { dailyPages, tasks: null, weeklyPages: null, notes: null },
      };
    }

    if (value.version !== BACKUP_VERSION || !value.data) return null;
    const dailyPages = parsePageStore(JSON.stringify(value.data.dailyPages));
    const tasks = parseTaskStore(JSON.stringify(value.data.tasks));
    const weeklyPages = parsePageStore(JSON.stringify(value.data.weeklyPages));
    const notes = parseNoteStore(JSON.stringify(value.data.notes));
    if (!dailyPages || !tasks || !weeklyPages || !notes) return null;
    return {
      version: BACKUP_VERSION,
      exportedAt: new Date(value.exportedAt).toISOString(),
      data: { dailyPages, tasks, weeklyPages, notes },
    };
  } catch {
    return null;
  }
}

export function createBackupFilename(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError("日付が正しくありません");
  return `study-canvas-backup-${date}.json`;
}

export function getBackupSummary(data) {
  const normalized = normalizeData(data);
  const daily = countPages(normalized.dailyPages);
  const weekly = countPages(normalized.weeklyPages);
  return {
    dailyPageCount: daily.pageCount,
    dailyStrokeCount: daily.strokeCount,
    taskCount: Object.values(normalized.tasks.tasksByDate).reduce((total, tasks) => total + tasks.length, 0),
    weeklyPageCount: weekly.pageCount,
    weeklyStrokeCount: weekly.strokeCount,
    noteCount: normalized.notes.order.length,
    noteStrokeCount: normalized.notes.order.reduce((total, id) =>
      total + (normalized.notes.notes[id]?.drawing.strokes.length || 0), 0),
  };
}

function normalizeData(data = {}) {
  return {
    dailyPages: JSON.parse(serializePageStore(data.dailyPages || emptyPageStore())),
    tasks: JSON.parse(serializeTaskStore(data.tasks || emptyTaskStore())),
    weeklyPages: JSON.parse(serializePageStore(data.weeklyPages || emptyPageStore())),
    notes: JSON.parse(serializeNoteStore(data.notes || emptyNoteStore())),
  };
}

function countPages(store) {
  const drawings = Object.values(store.pages).filter((drawing) => drawing.strokes.length > 0);
  return {
    pageCount: drawings.length,
    strokeCount: drawings.reduce((total, drawing) => total + drawing.strokes.length, 0),
  };
}
