import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dailyEnhancements = await readFile(new URL("../daily-enhancements.js", import.meta.url), "utf8");
const entry = await readFile(new URL("../taskize-entry.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../taskize-ui.js", import.meta.url), "utf8");
const model = await readFile(new URL("../src/taskize-model.js", import.meta.url), "utf8");
const preview = await readFile(new URL("../src/taskize-preview.js", import.meta.url), "utf8");
const css = await readFile(new URL("../taskize.css", import.meta.url), "utf8");

test("タスク化の入口と専用CSSを読み込む", () => {
  assert.match(dailyEnhancements, /taskize-entry\.js\?v=\d{8}-\d+/);
  assert.match(entry, /taskize\.css\?v=\d{8}-\d+/);
  assert.match(entry, /taskize-ui\.js\?v=\d{8}-\d+/);
  assert.match(css, /\.taskize-lasso-canvas/);
});

test("日別・週間目標・自由ノートで手書きを囲める", () => {
  assert.match(ui, /key: "daily"/);
  assert.match(ui, /key: "weekly"/);
  assert.match(ui, /key: "note"/);
  assert.match(ui, /selectDrawingByLasso/);
  assert.match(preview, /drawLassoOverlay/);
});

test("確認後だけ既存タスク保存領域へ追加する", () => {
  assert.match(ui, /addTaskFromHandwriting/);
  assert.match(ui, /replaceStoredTaskStore/);
  assert.match(ui, /dateInput\.value/);
  assert.match(model, /DUPLICATE_TASK/);
});

test("認識接続前の停止表示を維持する", () => {
  assert.match(ui, /外部AIへの送信、APIキー、料金設定はまだ接続していません/);
  assert.doesNotMatch(ui, /fetch\s*\(/);
});
