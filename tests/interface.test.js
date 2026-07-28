import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const enhancements = await readFile(new URL("../enhancements.css", import.meta.url), "utf8");
const script = await readFile(new URL("../script.js", import.meta.url), "utf8");
const taskUi = await readFile(new URL("../task-ui.js", import.meta.url), "utf8");
const taskStore = await readFile(new URL("../src/task-store.js", import.meta.url), "utf8");
const weeklyUi = await readFile(new URL("../weekly-text-ui.js", import.meta.url), "utf8");
const weeklyCardStore = await readFile(new URL("../src/weekly-card-store.js", import.meta.url), "utf8");
const noteUi = await readFile(new URL("../note-ui.js", import.meta.url), "utf8");
const noteStore = await readFile(new URL("../src/note-store.js", import.meta.url), "utf8");

test("日次キャンバスの手書き・選択・日付移動を維持する", () => {
  assert.match(html, /id="drawingCanvas"/);
  assert.match(html, /data-tool="pen"/);
  assert.match(html, /data-tool="eraser"/);
  assert.match(html, /data-tool="select"/);
  assert.match(html, /id="previousDateButton"/);
  assert.match(html, /id="todayButton"/);
  assert.match(html, /id="nextDateButton"/);
  assert.match(script, /deleteSelectedStrokes/);
  assert.match(script, /scaleSelectedStrokes/);
});

test("iPad幅では日付操作と描画ツールを重ならない2段ヘッダーにする", () => {
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*grid-template-areas:[\s\S]*"document history"[\s\S]*"tools tools"/);
  assert.doesNotMatch(css, /\.app-header \{[^}]*overflow-x:\s*auto/);
});

test("タスク入力から予定時間を外し、科目と内容だけにする", () => {
  assert.match(html, /id="taskSubject"/);
  assert.match(html, /id="taskTitle"/);
  assert.doesNotMatch(html, /id="taskMinutes"/);
  assert.doesNotMatch(taskUi, /taskMinutes/);
});

test("日次タスクは既存キーを維持し、週間カードIDと位置を保存する", () => {
  assert.match(taskStore, /TASK_STORAGE_KEY = "study-canvas:tasks:v1"/);
  assert.match(taskStore, /sourceWeeklyCardId/);
  assert.match(taskStore, /updateTaskPosition/);
  assert.match(taskUi, /sourceWeeklyCardId/);
  assert.match(taskUi, /replaceStoredTaskStore/);
});

test("週間目標は教科別テキストを改行ごとにカード化する", () => {
  assert.match(html, /id="weeklySubjectGrid"/);
  assert.match(html, /教科別に1行ずつ入力/);
  assert.doesNotMatch(html, /id="weeklyCanvas"/);
  assert.doesNotMatch(html, /AIで読み取る/);
  assert.match(weeklyUi, /split\(\/\\r\?\\n\/\)/);
  assert.match(weeklyUi, /WEEKLY_CARD_SUBJECTS/);
  assert.match(weeklyUi, /addWeeklyCards/);
});

test("週間カードを編集・削除でき、既存カード保存キーを維持する", () => {
  assert.match(weeklyUi, /updateWeeklyCard/);
  assert.match(weeklyUi, /deleteWeeklyCard/);
  assert.match(weeklyCardStore, /WEEKLY_CARD_STORAGE_KEY = "study-canvas:weekly-cards:v1"/);
  assert.match(weeklyCardStore, /replaceStoredWeeklyCardStore/);
});

test("週間カード棚から今日のキャンバスへドラッグ配置する", () => {
  assert.match(taskUi, /dailyWeeklyShelf/);
  assert.match(taskUi, /daily-weekly-drag-handle/);
  assert.match(taskUi, /is-weekly-drop-target/);
  assert.match(taskUi, /placeWeeklyCard/);
  assert.match(taskUi, /getLinkedTasksForWeek/);
  assert.match(enhancements, /\.daily-weekly-shelf/);
  assert.match(enhancements, /#dailyCanvasStage\.is-weekly-drop-target/);
});

test("正式画面からAI・OCR・時間集計を読み込まない", () => {
  assert.doesNotMatch(html, /weekly-recognition-entry/);
  assert.doesNotMatch(html, /AIで読み取る/);
  assert.doesNotMatch(html, /学習時間の集計/);
  assert.doesNotMatch(html, /予定時間/);
});

test("自由ノートの複数ページ手書き機能を維持する", () => {
  assert.match(html, /id="noteDialog"/);
  assert.match(html, /id="noteCanvas"/);
  assert.match(noteUi, /replaceStoredNoteStore/);
  assert.match(noteStore, /NOTE_STORAGE_KEY = "study-canvas:free-note:v1"/);
});

test("公開資産に更新版を指定する", () => {
  assert.match(html, /styles\.css\?v=20260729-1/);
  assert.match(html, /enhancements\.css\?v=20260729-1/);
  assert.match(html, /weekly-text\.css\?v=20260729-1/);
  assert.match(html, /task-ui\.js\?v=20260729-1/);
  assert.match(html, /weekly-text-ui\.js\?v=20260729-1/);
  assert.match(html, /release-entry\.js\?v=20260729-1/);
});
