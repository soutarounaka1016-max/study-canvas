import { BASE_HEIGHT, BASE_WIDTH, DRAWING_VERSION } from "./drawing-model.js?v=20260719-6";
import { BACKUP_FORMAT, BACKUP_VERSION, getBackupSummary } from "./backup.js?v=20260719-6";
import { PAGE_STORE_VERSION, loadPageStore, serializePageStore } from "./page-store.js?v=20260719-6";

export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseBackupForRestore(rawBackup) {
  if (typeof rawBackup !== "string" || rawBackup.trim() === "") {
    throw new TypeError("バックアップファイルが空です");
  }
  if (new TextEncoder().encode(rawBackup).byteLength > MAX_BACKUP_BYTES) {
    throw new TypeError("バックアップファイルが大きすぎます");
  }

  let value;
  try {
    value = JSON.parse(rawBackup);
  } catch {
    throw new TypeError("JSONファイルとして読み込めません");
  }

  if (!isPlainObject(value) || value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
    throw new TypeError("Study Canvasの対応バックアップではありません");
  }

  const exportedAt = new Date(value.exportedAt);
  if (typeof value.exportedAt !== "string" || Number.isNaN(exportedAt.getTime())) {
    throw new TypeError("バックアップの保存日時が正しくありません");
  }

  validatePageStore(value.pageStore);
  const loaded = loadPageStore(JSON.stringify(value.pageStore), null, "2000-01-01");
  if (loaded.migrated || loaded.recovered) {
    throw new TypeError("バックアップ内の手書きデータが正しくありません");
  }

  const pageStore = JSON.parse(serializePageStore(loaded.store));
  return {
    exportedAt: exportedAt.toISOString(),
    pageStore,
    ...getBackupSummary(pageStore),
  };
}

export function createPreRestoreBackupFilename(date) {
  if (!isValidDateKey(date)) throw new TypeError("日付が正しくありません");
  return `study-canvas-before-restore-${date}.json`;
}

export function replaceStoredPageStore(storage, storageKey, pageStore) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new TypeError("保存先を利用できません");
  }
  if (typeof storageKey !== "string" || storageKey === "") {
    throw new TypeError("保存先のキーが正しくありません");
  }

  const previousRaw = storage.getItem(storageKey);
  const nextRaw = serializePageStore(pageStore);

  try {
    storage.setItem(storageKey, nextRaw);
    if (storage.getItem(storageKey) !== nextRaw) throw new Error("書き込み結果を確認できませんでした");
  } catch (error) {
    try {
      if (previousRaw === null) storage.removeItem(storageKey);
      else storage.setItem(storageKey, previousRaw);
    } catch {
      throw new Error("復元に失敗し、元の保存状態も戻せませんでした。画面を閉じずにバックアップを保管してください。");
    }
    throw new Error("復元できませんでした。現在の保存データは変更されていません。", { cause: error });
  }

  return nextRaw;
}

function validatePageStore(pageStore) {
  if (!isPlainObject(pageStore) || pageStore.version !== PAGE_STORE_VERSION || !isPlainObject(pageStore.pages)) {
    throw new TypeError("バックアップ内のページ情報が正しくありません");
  }

  const pages = Object.entries(pageStore.pages);
  if (pages.length > 5000) throw new TypeError("バックアップ内のページ数が多すぎます");

  let strokeCount = 0;
  for (const [date, drawing] of pages) {
    if (!isValidDateKey(date) || !isPlainObject(drawing) || drawing.version !== DRAWING_VERSION) {
      throw new TypeError("バックアップ内の日付ページが正しくありません");
    }
    if (drawing.date !== date || !Array.isArray(drawing.strokes)) {
      throw new TypeError("バックアップ内のページと日付が一致しません");
    }

    strokeCount += drawing.strokes.length;
    if (strokeCount > 100000) throw new TypeError("バックアップ内の手書き線が多すぎます");
    for (const stroke of drawing.strokes) validateStroke(stroke);
  }
}

function validateStroke(stroke) {
  if (!isPlainObject(stroke) || typeof stroke.id !== "string" || stroke.id === "") {
    throw new TypeError("バックアップ内の手書き線が正しくありません");
  }
  if (typeof stroke.color !== "string" || stroke.color.length === 0 || stroke.color.length > 64) {
    throw new TypeError("バックアップ内のペン色が正しくありません");
  }
  if (!Number.isFinite(stroke.width) || stroke.width <= 0 || stroke.width > BASE_WIDTH) {
    throw new TypeError("バックアップ内の線の太さが正しくありません");
  }
  if (!Array.isArray(stroke.points) || stroke.points.length === 0) {
    throw new TypeError("バックアップ内の線の座標が不足しています");
  }

  for (const point of stroke.points) {
    if (!isPlainObject(point) || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
      point.x < 0 || point.x > BASE_WIDTH || point.y < 0 || point.y > BASE_HEIGHT) {
      throw new TypeError("バックアップ内の線の座標が正しくありません");
    }
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDateKey(value) {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}
