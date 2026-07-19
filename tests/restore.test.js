import assert from "node:assert/strict";
import test from "node:test";
import { createBackup, serializeBackup } from "../src/backup.js";
import { emptyPageStore, setPageDrawing } from "../src/page-store.js";
import {
  MAX_BACKUP_BYTES,
  createPreRestoreBackupFilename,
  parseBackupForRestore,
  replaceStoredPageStore,
} from "../src/restore.js";

const stroke = {
  id: "stroke-1",
  color: "#2558e6",
  width: 5,
  points: [{ x: 10, y: 10 }, { x: 100, y: 100 }],
};

function createStore() {
  return setPageDrawing(emptyPageStore(), "2026-07-19", {
    version: 1,
    date: "2026-07-19",
    strokes: [stroke],
  });
}

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test("対応バックアップを検査して復元用データと件数を返す", () => {
  const restored = parseBackupForRestore(serializeBackup(createStore(), "2026-07-19T14:30:00.000Z"));

  assert.equal(restored.exportedAt, "2026-07-19T14:30:00.000Z");
  assert.equal(restored.writtenPageCount, 1);
  assert.equal(restored.strokeCount, 1);
  assert.deepEqual(restored.pageStore, createStore());
});

test("形式・版・日時・ページ内容が不正なファイルを拒否する", () => {
  const valid = createBackup(createStore(), "2026-07-19T14:30:00.000Z");

  assert.throws(() => parseBackupForRestore("not json"), /JSONファイル/);
  assert.throws(() => parseBackupForRestore(JSON.stringify({ ...valid, format: "other" })), /対応バックアップ/);
  assert.throws(() => parseBackupForRestore(JSON.stringify({ ...valid, version: 999 })), /対応バックアップ/);
  assert.throws(() => parseBackupForRestore(JSON.stringify({ ...valid, exportedAt: "invalid" })), /保存日時/);
  assert.throws(() => parseBackupForRestore(JSON.stringify({ ...valid, pageStore: { version: 2, pages: [] } })), /ページ情報/);
  assert.throws(() => parseBackupForRestore(JSON.stringify({
    ...valid,
    pageStore: {
      version: 2,
      pages: {
        "2026-07-19": { version: 1, date: "2026-07-18", strokes: [stroke] },
      },
    },
  })), /ページと日付/);
});

test("大きすぎるバックアップを読み込まない", () => {
  assert.throws(() => parseBackupForRestore("x".repeat(MAX_BACKUP_BYTES + 1)), /大きすぎます/);
});

test("復元用データは元のバックアップオブジェクトから切り離す", () => {
  const original = createBackup(createStore(), "2026-07-19T14:30:00.000Z");
  const restored = parseBackupForRestore(JSON.stringify(original));
  restored.pageStore.pages["2026-07-19"].strokes[0].points[0].x = 999;

  assert.equal(original.pageStore.pages["2026-07-19"].strokes[0].points[0].x, 10);
});

test("復元前バックアップのファイル名を区別する", () => {
  assert.equal(
    createPreRestoreBackupFilename("2026-07-20"),
    "study-canvas-before-restore-2026-07-20.json",
  );
  assert.throws(() => createPreRestoreBackupFilename("2026-02-30"), /日付が正しくありません/);
});

test("保存先へ復元データを書き込み、読み戻して確認する", () => {
  const storage = createMemoryStorage({ pages: "old-value" });
  const raw = replaceStoredPageStore(storage, "pages", createStore());

  assert.equal(storage.getItem("pages"), raw);
  assert.deepEqual(JSON.parse(raw), createStore());
});

test("書き込みに失敗した場合は以前の保存データへ戻す", () => {
  let writeCount = 0;
  const storage = createMemoryStorage({ pages: "old-value" });
  const originalSetItem = storage.setItem;
  storage.setItem = (key, value) => {
    writeCount += 1;
    if (writeCount === 1) throw new Error("quota");
    originalSetItem(key, value);
  };

  assert.throws(() => replaceStoredPageStore(storage, "pages", createStore()), /変更されていません/);
  assert.equal(storage.getItem("pages"), "old-value");
});
