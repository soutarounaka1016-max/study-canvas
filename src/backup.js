import { serializePageStore } from "./page-store.js?v=20260719-5";

export const BACKUP_FORMAT = "study-canvas-backup";
export const BACKUP_VERSION = 1;

export function createBackup(pageStore, exportedAt = new Date()) {
  const timestamp = new Date(exportedAt);
  if (Number.isNaN(timestamp.getTime())) throw new TypeError("書き出し日時が正しくありません");

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: timestamp.toISOString(),
    pageStore: JSON.parse(serializePageStore(pageStore)),
  };
}

export function serializeBackup(pageStore, exportedAt = new Date()) {
  return `${JSON.stringify(createBackup(pageStore, exportedAt), null, 2)}\n`;
}

export function createBackupFilename(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError("日付が正しくありません");
  return `study-canvas-backup-${date}.json`;
}

export function getBackupSummary(pageStore) {
  const safeStore = JSON.parse(serializePageStore(pageStore));
  const writtenPages = Object.values(safeStore.pages)
    .filter((drawing) => drawing.strokes.length > 0);
  return {
    writtenPageCount: writtenPages.length,
    strokeCount: writtenPages.reduce((total, drawing) => total + drawing.strokes.length, 0),
  };
}
