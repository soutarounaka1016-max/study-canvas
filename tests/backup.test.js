import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  createBackup,
  createBackupFilename,
  getBackupSummary,
  parseBackup,
  serializeBackup,
} from "../src/backup.js";
import { createNote, emptyNoteStore, setNoteDrawing } from "../src/note-store.js";
import { emptyPageStore, setPageDrawing } from "../src/page-store.js";
import { addTask, emptyTaskStore } from "../src/task-store.js";

const stroke = {
  id: "stroke-1", color: "#2558e6", width: 5,
  points: [{ x: 10, y: 10 }, { x: 100, y: 100 }],
};

function pageStore(date = "2026-07-19") {
  return setPageDrawing(emptyPageStore(), date, { version: 1, date, strokes: [stroke] });
}

function allData() {
  let notes = createNote(emptyNoteStore(), "note-1", "模試の反省", "2026-07-19T14:30:00.000Z");
  notes = setNoteDrawing(notes, "note-1", { version: 1, date: "", strokes: [stroke] });
  const tasks = addTask(emptyTaskStore(), "2026-07-19", {
    id: "task-1", subject: "数学", title: "微積", minutes: 60, completed: false, x: 20, y: 30,
  });
  return {
    dailyPages: pageStore(),
    tasks,
    weeklyPages: pageStore("2026-07-20"),
    notes,
  };
}

test("日別・タスク・週間・自由ノートを1つのバックアップにまとめる", () => {
  const data = allData();
  const backup = createBackup(data, "2026-07-19T14:30:00.000Z");
  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.version, BACKUP_VERSION);
  assert.equal(backup.exportedAt, "2026-07-19T14:30:00.000Z");
  assert.deepEqual(backup.data, data);
});

test("バックアップ作成時に元のデータを書き換えない", () => {
  const data = allData();
  const original = structuredClone(data);
  const backup = createBackup(data, "2026-07-19T14:30:00.000Z");
  backup.data.dailyPages.pages["2026-07-19"].strokes[0].points[0].x = 999;
  assert.deepEqual(data, original);
});

test("v2バックアップを検査して復元用データへ戻せる", () => {
  const serialized = serializeBackup(allData(), "2026-07-19T14:30:00.000Z");
  const parsed = parseBackup(serialized);
  assert.equal(parsed.version, BACKUP_VERSION);
  assert.equal(parsed.data.tasks.tasksByDate["2026-07-19"].length, 1);
  assert.equal(parsed.data.notes.order.length, 1);
  assert.equal(serialized.endsWith("\n"), true);
});

test("以前に作ったv1バックアップも日別手書きとして読み込める", () => {
  const oldBackup = JSON.stringify({
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: "2026-07-19T14:30:00.000Z",
    pageStore: pageStore(),
  });
  const parsed = parseBackup(oldBackup);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.data.dailyPages.pages["2026-07-19"].strokes.length, 1);
  assert.equal(parsed.data.tasks, null);
});

test("壊れたファイルや別形式のJSONを拒否する", () => {
  assert.equal(parseBackup("{broken"), null);
  assert.equal(parseBackup(JSON.stringify({ format: "other", version: 2 })), null);
  assert.equal(parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99, exportedAt: new Date().toISOString() })), null);
});

test("バックアップファイル名に書き出し日を含める", () => {
  assert.equal(createBackupFilename("2026-07-20"), "study-canvas-backup-2026-07-20.json");
  assert.throws(() => createBackupFilename("July 20"), /日付が正しくありません/);
});

test("含まれるページ・線・タスク・ノート数を数える", () => {
  assert.deepEqual(getBackupSummary(allData()), {
    dailyPageCount: 1, dailyStrokeCount: 1, taskCount: 1,
    weeklyPageCount: 1, weeklyStrokeCount: 1, noteCount: 1, noteStrokeCount: 1,
  });
});
