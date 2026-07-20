import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardEntry = await readFile(new URL("../dashboard-entry.js", import.meta.url), "utf8");
const entry = await readFile(new URL("../full-backup-entry.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../full-backup-ui.js", import.meta.url), "utf8");
const model = await readFile(new URL("../src/full-backup.js", import.meta.url), "utf8");

test("integrated backup replaces the old menu action", () => {
  assert.match(dashboardEntry, /full-backup-entry\.js/);
  assert.match(entry, /full-backup-ui\.js/);
  assert.match(ui, /全データのバックアップを保存/);
  assert.match(ui, /capture: true/);
});

test("restore supports all data sections and legacy pages", () => {
  for (const section of ["pages", "tasks", "weekly", "notes"]) {
    assert.match(ui, new RegExp(`value="${section}"`));
  }
  assert.match(model, /legacy-pages-only/);
  assert.match(model, /parseBackupForRestore/);
});

test("restore creates a current full backup before writing", () => {
  assert.match(ui, /readCurrentFullState/);
  assert.match(ui, /createFullBackupFilename\(today, true\)/);
  assert.match(ui, /downloadText\(beforeRaw/);
  assert.match(ui, /applyFullRestore/);
});

test("model records rollback paths for every selected store", () => {
  assert.match(model, /previousRaw/);
  assert.match(model, /rollbackFailed/);
  assert.match(model, /storage\.removeItem/);
  assert.match(model, /変更されていません/);
});
