import test from "node:test";
import assert from "node:assert/strict";
import { emptyDrawing } from "../src/drawing-model.js";
import { emptyPageStore, setPageDrawing } from "../src/page-store.js";
import { addTask, emptyTaskStore } from "../src/task-store.js";
import { emptyNoteStore, setNoteDrawing } from "../src/note-store.js";
import { setWeeklyDrawing } from "../src/weekly-store.js";
import {
  FULL_BACKUP_FORMAT,
  FULL_BACKUP_KEYS,
  applyFullRestore,
  createFullBackup,
  parseFullBackup,
  serializeFullBackup,
  summarizeFullState,
} from "../src/full-backup.js";

function drawing(date, id = "stroke-1") {
  const value = emptyDrawing(date);
  value.strokes.push({ id, color: "#2558e6", width: 5, points: [{ x: 10, y: 10 }, { x: 50, y: 50 }] });
  return value;
}

function sampleState() {
  const pages = setPageDrawing(emptyPageStore(), "2026-07-20", drawing("2026-07-20"));
  const tasks = addTask(emptyTaskStore(), "2026-07-20", {
    subject: "数学", title: "微積", plannedMinutes: 30,
  }, "task-1");
  const weekly = setWeeklyDrawing({}, "2026-07-20", "数学", drawing("2026-07-20", "week-1"));
  const noteBase = emptyNoteStore();
  const notes = setNoteDrawing(noteBase, drawing(noteBase.activePageId, "note-stroke"));
  return { pages, tasks, weekly, notes };
}

class MemoryStorage {
  constructor(initial = {}, failKey = null) {
    this.values = new Map(Object.entries(initial));
    this.failKey = failKey;
    this.hasFailed = false;
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) {
    if (key === this.failKey && !this.hasFailed) {
      this.hasFailed = true;
      throw new Error("simulated write failure");
    }
    this.values.set(key, String(value));
  }
  removeItem(key) { this.values.delete(key); }
}

test("full backup round trips every store", () => {
  const state = sampleState();
  const raw = serializeFullBackup(state, "2026-07-20T00:00:00.000Z");
  const parsed = parseFullBackup(raw, "2026-07-20");
  assert.equal(parsed.format, FULL_BACKUP_FORMAT);
  assert.deepEqual(parsed.data, createFullBackup(state, "2026-07-20T00:00:00.000Z").data);
  assert.deepEqual(parsed.availableSections, ["pages", "tasks", "weekly", "notes"]);
});

test("summary counts all saved content", () => {
  assert.deepEqual(summarizeFullState(sampleState()), {
    dailyPageCount: 1,
    dailyStrokeCount: 1,
    taskCount: 1,
    weeklyPageCount: 1,
    weeklySubjectPageCount: 1,
    weeklyStrokeCount: 1,
    notePageCount: 1,
    noteStrokeCount: 1,
  });
});

test("partial restore only replaces selected stores", () => {
  const state = sampleState();
  const parsed = parseFullBackup(serializeFullBackup(state), "2026-07-20");
  const storage = new MemoryStorage({
    [FULL_BACKUP_KEYS.pages]: "old-pages",
    [FULL_BACKUP_KEYS.tasks]: "old-tasks",
    [FULL_BACKUP_KEYS.weekly]: "old-weekly",
    [FULL_BACKUP_KEYS.notes]: "old-notes",
  });
  assert.deepEqual(applyFullRestore(storage, parsed, ["tasks", "notes"]), ["tasks", "notes"]);
  assert.equal(storage.getItem(FULL_BACKUP_KEYS.pages), "old-pages");
  assert.notEqual(storage.getItem(FULL_BACKUP_KEYS.tasks), "old-tasks");
  assert.equal(storage.getItem(FULL_BACKUP_KEYS.weekly), "old-weekly");
  assert.notEqual(storage.getItem(FULL_BACKUP_KEYS.notes), "old-notes");
});

test("failed multi-store restore rolls every selected store back", () => {
  const parsed = parseFullBackup(serializeFullBackup(sampleState()), "2026-07-20");
  const oldPages = JSON.stringify({ old: "pages" });
  const oldTasks = JSON.stringify({ old: "tasks" });
  const storage = new MemoryStorage({
    [FULL_BACKUP_KEYS.pages]: oldPages,
    [FULL_BACKUP_KEYS.tasks]: oldTasks,
  }, FULL_BACKUP_KEYS.tasks);
  assert.throws(() => applyFullRestore(storage, parsed, ["pages", "tasks"]), /変更されていません/);
  assert.equal(storage.getItem(FULL_BACKUP_KEYS.pages), oldPages);
  assert.equal(storage.getItem(FULL_BACKUP_KEYS.tasks), oldTasks);
});

test("invalid full backup is rejected before writing", () => {
  const backup = createFullBackup(sampleState());
  backup.data.tasks.version = 999;
  assert.throws(() => parseFullBackup(JSON.stringify(backup), "2026-07-20"), /タスクデータ/);
});
