import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  createBackup,
  createBackupFilename,
  getBackupSummary,
  serializeBackup,
} from "../src/backup.js";
import { emptyPageStore, setPageDrawing } from "../src/page-store.js";

const stroke = {
  id: "stroke-1",
  color: "#2558e6",
  width: 5,
  points: [{ x: 10, y: 10 }, { x: 100, y: 100 }],
};

function createStore() {
  const first = setPageDrawing(emptyPageStore(), "2026-07-18", {
    version: 1, date: "2026-07-18", strokes: [stroke],
  });
  return setPageDrawing(first, "2026-07-19", {
    version: 1, date: "2026-07-19", strokes: [{ ...stroke, id: "stroke-2" }],
  });
}

test("全日付の手書きを識別情報と日時付きでバックアップする", () => {
  const store = createStore();
  const backup = createBackup(store, "2026-07-19T14:30:00.000Z");

  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.version, BACKUP_VERSION);
  assert.equal(backup.exportedAt, "2026-07-19T14:30:00.000Z");
  assert.deepEqual(backup.pageStore, store);
});

test("バックアップ作成時に元の保存データを書き換えない", () => {
  const store = createStore();
  const original = structuredClone(store);
  const backup = createBackup(store, "2026-07-19T14:30:00.000Z");
  backup.pageStore.pages["2026-07-18"].strokes[0].points[0].x = 999;

  assert.deepEqual(store, original);
});

test("バックアップJSONは改行付きで、人が確認できる形式にする", () => {
  const serialized = serializeBackup(createStore(), "2026-07-19T14:30:00.000Z");

  assert.match(serialized, /\n  "format": "study-canvas-backup"/);
  assert.equal(serialized.endsWith("\n"), true);
  assert.equal(JSON.parse(serialized).pageStore.pages["2026-07-19"].strokes.length, 1);
});

test("バックアップファイル名に書き出し日を含める", () => {
  assert.equal(createBackupFilename("2026-07-19"), "study-canvas-backup-2026-07-19.json");
  assert.throws(() => createBackupFilename("July 19"), /日付が正しくありません/);
});

test("手書きがある日数と線の本数を数える", () => {
  const withBlankPage = setPageDrawing(createStore(), "2026-07-20", {
    version: 1, date: "2026-07-20", strokes: [],
  });

  assert.deepEqual(getBackupSummary(withBlankPage), { writtenPageCount: 2, strokeCount: 2 });
});
