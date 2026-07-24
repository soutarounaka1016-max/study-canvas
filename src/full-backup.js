import { loadPageStore, serializePageStore } from "./page-store.js";
import { loadTaskStore, serializeTaskStore } from "./task-store.js";
import { listWeeklyDrawings, loadWeeklyStore, serializeWeeklyStore } from "./weekly-store.js";
import { loadNoteStore, serializeNoteStore } from "./note-store.js";
import { parseBackupForRestore } from "./restore.js";

export const FULL_BACKUP_FORMAT = "study-canvas-full-backup";
export const FULL_BACKUP_VERSION = 1;
export const FULL_BACKUP_KEYS = {
  pages: "study-canvas:pages:v2",
  tasks: "study-canvas:tasks:v1",
  weekly: "study-canvas:weekly:v1",
  notes: "study-canvas:free-note:v1",
};
const MAX_FULL_BACKUP_BYTES = 24 * 1024 * 1024;

export function readCurrentFullState(storage, currentDate) {
  return {
    pages: loadPageStore(storage.getItem(FULL_BACKUP_KEYS.pages), null, currentDate).store,
    tasks: loadTaskStore(storage.getItem(FULL_BACKUP_KEYS.tasks)).store,
    weekly: loadWeeklyStore(storage.getItem(FULL_BACKUP_KEYS.weekly), currentDate).store,
    notes: loadNoteStore(storage.getItem(FULL_BACKUP_KEYS.notes)).store,
  };
}

export function createFullBackup(state, exportedAt = new Date().toISOString()) {
  const date = new Date(exportedAt);
  if (Number.isNaN(date.getTime())) throw new TypeError("保存日時が正しくありません");
  const stores = canonicalizeState(state, "2000-01-03");
  return {
    format: FULL_BACKUP_FORMAT,
    version: FULL_BACKUP_VERSION,
    exportedAt: date.toISOString(),
    data: stores,
  };
}

export function serializeFullBackup(state, exportedAt) {
  return JSON.stringify(createFullBackup(state, exportedAt), null, 2);
}

export function parseFullBackup(rawBackup, currentDate) {
  if (typeof rawBackup !== "string" || rawBackup.trim() === "") {
    throw new TypeError("バックアップファイルが空です");
  }
  if (new TextEncoder().encode(rawBackup).byteLength > MAX_FULL_BACKUP_BYTES) {
    throw new TypeError("バックアップファイルが大きすぎます");
  }

  let value;
  try {
    value = JSON.parse(rawBackup);
  } catch {
    throw new TypeError("JSONファイルとして読み込めません");
  }

  if (value?.format !== FULL_BACKUP_FORMAT) {
    const legacy = parseBackupForRestore(rawBackup);
    return {
      format: "legacy-pages-only",
      exportedAt: legacy.exportedAt,
      availableSections: ["pages"],
      data: { pages: legacy.pageStore },
      summary: summarizeFullState({ pages: legacy.pageStore }),
    };
  }

  if (value.version !== FULL_BACKUP_VERSION || !value.data || typeof value.data !== "object" || Array.isArray(value.data)) {
    throw new TypeError("Study Canvasの対応統合バックアップではありません");
  }
  const exportedAt = new Date(value.exportedAt);
  if (typeof value.exportedAt !== "string" || Number.isNaN(exportedAt.getTime())) {
    throw new TypeError("バックアップの保存日時が正しくありません");
  }

  const data = canonicalizeState(value.data, currentDate);
  return {
    format: FULL_BACKUP_FORMAT,
    exportedAt: exportedAt.toISOString(),
    availableSections: ["pages", "tasks", "weekly", "notes"],
    data,
    summary: summarizeFullState(data),
  };
}

export function applyFullRestore(storage, parsedBackup, sections) {
  const selected = normalizeSections(sections, parsedBackup.availableSections);
  if (selected.length === 0) throw new TypeError("復元する項目を選んでください");

  const nextRaw = canonicalRawBySection(parsedBackup.data);
  const previousRaw = Object.fromEntries(selected.map((section) => [section, storage.getItem(FULL_BACKUP_KEYS[section])]));

  try {
    for (const section of selected) {
      storage.setItem(FULL_BACKUP_KEYS[section], nextRaw[section]);
      if (storage.getItem(FULL_BACKUP_KEYS[section]) !== nextRaw[section]) {
        throw new Error("書き込み結果を確認できませんでした");
      }
    }
  } catch (error) {
    let rollbackFailed = false;
    for (const section of selected) {
      try {
        const key = FULL_BACKUP_KEYS[section];
        if (previousRaw[section] === null) storage.removeItem(key);
        else storage.setItem(key, previousRaw[section]);
        if (storage.getItem(key) !== previousRaw[section]) rollbackFailed = true;
      } catch {
        rollbackFailed = true;
      }
    }
    if (rollbackFailed) {
      throw new Error("復元に失敗し、元の保存状態も完全には戻せませんでした。画面を閉じず、退避ファイルを保管してください。", { cause: error });
    }
    throw new Error("復元できませんでした。現在の保存データは変更されていません。", { cause: error });
  }

  return selected;
}

export function summarizeFullState(state) {
  const pages = Object.values(state?.pages?.pages || {});
  const taskDates = Object.values(state?.tasks?.tasksByDate || {});
  const weeklyDrawings = listWeeklyDrawings(state?.weekly);
  const writtenWeeks = new Set(weeklyDrawings.map((item) => item.weekStart));
  const notes = Array.isArray(state?.notes?.pages) ? state.notes.pages : [];
  return {
    dailyPageCount: pages.filter((drawing) => drawing?.strokes?.length > 0).length,
    dailyStrokeCount: countPageStoreStrokes(state?.pages),
    taskCount: taskDates.reduce((sum, tasks) => sum + tasks.length, 0),
    weeklyPageCount: writtenWeeks.size,
    weeklySubjectPageCount: weeklyDrawings.length,
    weeklyStrokeCount: weeklyDrawings.reduce((sum, item) => sum + item.drawing.strokes.length, 0),
    notePageCount: notes.length,
    noteStrokeCount: notes.reduce((sum, page) => sum + (page?.drawing?.strokes?.length || 0), 0),
  };
}

export function createFullBackupFilename(date, beforeRestore = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError("日付が正しくありません");
  return beforeRestore ? `study-canvas-before-full-restore-${date}.json` : `study-canvas-full-backup-${date}.json`;
}

function canonicalizeState(state, currentDate) {
  const pageRaw = JSON.stringify(state?.pages);
  const pagesLoaded = loadPageStore(pageRaw, null, currentDate);
  if (pagesLoaded.recovered || pagesLoaded.migrated) throw new TypeError("日別手書きデータが正しくありません");

  const taskLoaded = loadTaskStore(JSON.stringify(state?.tasks));
  if (taskLoaded.recovered) throw new TypeError("タスクデータが正しくありません");

  const weeklyLoaded = loadWeeklyStore(JSON.stringify(state?.weekly), currentDate);
  if (weeklyLoaded.recovered) throw new TypeError("週間目標データが正しくありません");

  const noteLoaded = loadNoteStore(JSON.stringify(state?.notes));
  if (noteLoaded.recovered || noteLoaded.migrated) throw new TypeError("自由ノートデータが正しくありません");

  return {
    pages: JSON.parse(serializePageStore(pagesLoaded.store)),
    tasks: JSON.parse(serializeTaskStore(taskLoaded.store)),
    weekly: JSON.parse(serializeWeeklyStore(weeklyLoaded.store)),
    notes: JSON.parse(serializeNoteStore(noteLoaded.store)),
  };
}

function canonicalRawBySection(data) {
  const raw = {};
  if (data.pages) raw.pages = serializePageStore(data.pages);
  if (data.tasks) raw.tasks = serializeTaskStore(data.tasks);
  if (data.weekly) raw.weekly = serializeWeeklyStore(data.weekly);
  if (data.notes) raw.notes = serializeNoteStore(data.notes);
  return raw;
}

function normalizeSections(sections, available) {
  const allowed = new Set(available || []);
  return [...new Set(Array.isArray(sections) ? sections : [])].filter((section) => allowed.has(section));
}

function countPageStoreStrokes(store) {
  return Object.values(store?.pages || {}).reduce((sum, drawing) => sum + (drawing?.strokes?.length || 0), 0);
}
