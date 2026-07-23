import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const noteCss = await readFile(new URL("../note.css", import.meta.url), "utf8");
const script = await readFile(new URL("../script.js", import.meta.url), "utf8");
const backupScript = await readFile(new URL("../src/backup.js", import.meta.url), "utf8");
const restoreUi = await readFile(new URL("../restore-ui.js", import.meta.url), "utf8");
const restoreScript = await readFile(new URL("../src/restore.js", import.meta.url), "utf8");
const taskUi = await readFile(new URL("../task-ui.js", import.meta.url), "utf8");
const taskStore = await readFile(new URL("../src/task-store.js", import.meta.url), "utf8");
const weeklyUi = await readFile(new URL("../weekly-ui.js", import.meta.url), "utf8");
const weeklyStore = await readFile(new URL("../src/weekly-store.js", import.meta.url), "utf8");
const noteUi = await readFile(new URL("../note-ui.js", import.meta.url), "utf8");
const noteStore = await readFile(new URL("../src/note-store.js", import.meta.url), "utf8");

test("不要と決めた指す・文字入力をツールバーに表示しない", () => {
  assert.doesNotMatch(html, /指す（今後追加）/);
  assert.doesNotMatch(html, /文字入力（今後追加）/);
});

test("選ぶを使える状態にし、独立した動かす機能を表示しない", () => {
  assert.match(html, /data-tool="select"/);
  assert.doesNotMatch(html, /移動（今後追加）/);
  assert.doesNotMatch(html, /<small>動かす<\/small>/);
  assert.match(html, /id="selectionHint"/);
});

test("選択枠を再度押すと選んだ手書きを削除できる", () => {
  assert.match(html, /id="selectionDeleteButton"[^>]*hidden/);
  assert.match(script, /selectionActionsVisible = true/);
  assert.match(script, /deleteSelectedStrokes/);
});

test("選択枠の四隅をドラッグして手書きを拡大縮小できる", () => {
  assert.match(script, /getResizeHandles/);
  assert.match(script, /drawSelectionHandle/);
  assert.match(script, /scaleSelectedStrokes/);
  assert.match(script, /四隅の丸で拡大・縮小できます/);
});

test("青・赤・黒とペンの太さ調整を維持する", () => {
  assert.match(html, /aria-label="青"/);
  assert.match(html, /aria-label="赤"/);
  assert.match(html, /aria-label="黒"/);
  assert.match(html, /id="penWidth"[^>]*type="range"/);
});

test("前日・今日・翌日のページへ移動できる操作を表示する", () => {
  assert.match(html, /id="previousDateButton"/);
  assert.match(html, /id="todayButton"/);
  assert.match(html, /id="nextDateButton"/);
});

test("ダブルタップ拡大を防ぎ、閲覧モードのタッチ操作を維持する", () => {
  assert.match(css, /\.page\.is-viewing #drawingCanvas[^}]*touch-action:\s*manipulation/);
  assert.match(script, /addEventListener\("dblclick"[^;]*preventDefault/);
});

test("Safariの長押しによる文字選択とメニューを抑止する", () => {
  assert.match(css, /-webkit-touch-callout:\s*none/);
  assert.match(css, /-webkit-user-select:\s*none/);
  assert.match(css, /user-select:\s*none/);
  assert.match(script, /addEventListener\("selectstart"[^;]*preventDefault/);
  assert.match(script, /addEventListener\("contextmenu"[^;]*preventDefault/);
});

test("ページ一覧をサムネイルから開ける", () => {
  assert.match(html, /id="pageListButton"/);
  assert.match(html, /id="pageListDialog"/);
  assert.match(html, /id="pageList"/);
  assert.match(script, /listWrittenPageDates/);
  assert.match(script, /drawThumbnail/);
});

test("メニューから全ページのJSONバックアップを保存できる", () => {
  assert.match(html, /id="backupButton"/);
  assert.match(html, /id="backupStatus"[^>]*role="status"/);
  assert.match(script, /serializeBackup/);
  assert.match(script, /createObjectURL/);
  assert.match(script, /createBackupFilename/);
  assert.match(backupScript, /BACKUP_FORMAT = "study-canvas-backup"/);
});

test("バックアップ復元はファイル選択と確認画面を分ける", () => {
  assert.match(html, /id="restoreButton"/);
  assert.match(html, /id="restoreFile"[^>]*type="file"[^>]*hidden/);
  assert.match(html, /id="restoreDialog"/);
  assert.match(html, /id="confirmRestoreButton"/);
  assert.match(html, /まだ現在のデータは変更されていません/);
});

test("復元前に現在データを別ファイルへ退避する", () => {
  assert.match(restoreUi, /serializeBackup\(current/);
  assert.match(restoreUi, /createPreRestoreBackupFilename/);
  assert.match(restoreUi, /replaceStoredPageStore/);
  assert.match(restoreScript, /previousRaw/);
});

test("復元後は再読み込みして正式な保存データから描画する", () => {
  assert.match(restoreUi, /window\.location\.reload/);
});

test("日付別タスクを入力する画面を表示する", () => {
  assert.match(html, /id="taskButton"/);
  assert.match(html, /id="taskDialog"/);
  assert.match(html, /id="taskSubject"/);
  assert.match(html, /id="taskTitle"/);
  assert.match(html, /id="taskMinutes"/);
  assert.match(html, /id="taskList"/);
});

test("タスクは手書きと別のlocalStorageキーへ日付別に保存する", () => {
  assert.match(taskStore, /TASK_STORAGE_KEY = "study-canvas:tasks:v1"/);
  assert.match(taskStore, /tasksByDate/);
  assert.match(taskUi, /MutationObserver/);
  assert.match(taskUi, /pageDate\.dateTime/);
  assert.doesNotMatch(taskUi, /study-canvas:pages:v2/);
});

test("タスクの追加・編集・完了・削除を行える", () => {
  assert.match(taskUi, /addTask/);
  assert.match(taskUi, /updateTask/);
  assert.match(taskUi, /toggleTask/);
  assert.match(taskUi, /deleteTask/);
  assert.match(taskUi, /window\.confirm/);
  assert.match(taskStore, /replaceStoredTaskStore/);
});

test("統合バックアップにタスクカードと配置が含まれることを案内する", () => {
  assert.match(html, /全データをバックアップ/);
  assert.match(html, /タスクカードと配置は全データバックアップに含まれます/);
  assert.doesNotMatch(html, /タスクカードは現在の手書きJSONバックアップには含まれません/);
});

test("週間目標を別の手書きキャンバスで開ける", () => {
  assert.match(html, /id="weeklyButton"/);
  assert.match(html, /id="weeklyDialog"/);
  assert.match(html, /id="weeklyCanvas"/);
  assert.match(html, /data-weekly-tool="pen"/);
  assert.match(html, /data-weekly-tool="eraser"/);
  assert.match(html, /id="weeklyUndoButton"/);
  assert.match(html, /id="weeklyRedoButton"/);
});

test("週間目標は月曜日単位で別の保存キーへ保存する", () => {
  assert.match(weeklyStore, /WEEKLY_STORAGE_KEY = "study-canvas:weekly:v1"/);
  assert.match(weeklyStore, /getWeekStart/);
  assert.match(weeklyStore, /shiftWeek/);
  assert.match(weeklyUi, /replaceStoredWeeklyStore/);
  assert.doesNotMatch(weeklyUi, /study-canvas:pages:v2/);
  assert.doesNotMatch(weeklyUi, /study-canvas:tasks:v1/);
});

test("週間目標から今日のタスクを自動作成しない", () => {
  assert.match(html, /今日のタスクは自動作成しません/);
  assert.doesNotMatch(weeklyUi, /addTask/);
  assert.doesNotMatch(weeklyUi, /task-store/);
});

test("統合バックアップに週間目標が含まれることを案内する", () => {
  assert.match(html, /週間目標は全データバックアップに含まれます/);
  assert.doesNotMatch(html, /週間目標は現在の手書きJSONバックアップには含まれません/);
});

test("自由ノートを日付に縛られない手書きキャンバスで開ける", () => {
  assert.match(html, /id="noteButton"/);
  assert.match(html, /id="noteDialog"/);
  assert.match(html, /id="noteCanvas"/);
  assert.match(html, /data-note-tool="pen"/);
  assert.match(html, /data-note-tool="eraser"/);
  assert.match(html, /id="noteUndoButton"/);
  assert.match(html, /id="noteRedoButton"/);
  assert.match(noteCss, /#noteCanvas[^}]*touch-action:\s*none/);
});

test("自由ノートは日別手書き・タスク・週間目標と別のキーへ保存する", () => {
  assert.match(noteStore, /NOTE_STORAGE_KEY = "study-canvas:free-note:v1"/);
  assert.match(noteUi, /replaceStoredNoteStore/);
  assert.doesNotMatch(noteUi, /study-canvas:pages:v2/);
  assert.doesNotMatch(noteUi, /study-canvas:tasks:v1/);
  assert.doesNotMatch(noteUi, /study-canvas:weekly:v1/);
});

test("自由ノートは確認付き白紙化と保存失敗時の復帰に対応する", () => {
  assert.match(noteUi, /window\.confirm\("自由ノートを白紙に戻しますか？"\)/);
  assert.match(noteStore, /previousRaw/);
  assert.match(noteStore, /保存結果を確認できませんでした/);
});

test("統合バックアップに自由ノートが含まれることを案内する", () => {
  assert.match(html, /自由ノートは全データバックアップに含まれます/);
  assert.doesNotMatch(html, /自由ノートは現在の手書きJSONバックアップには含まれません/);
});

test("公開後に更新したCSSとJavaScriptを確実に読み込む", () => {
  assert.match(html, /styles\.css\?v=\d{8}-\d+/);
  assert.match(html, /note\.css\?v=\d{8}-\d+/);
  assert.match(html, /script\.js\?v=\d{8}-\d+/);
  assert.match(html, /restore-ui\.js\?v=\d{8}-\d+/);
  assert.match(html, /task-ui\.js\?v=\d{8}-\d+/);
  assert.match(html, /weekly-ui\.js\?v=\d{8}-\d+/);
  assert.match(html, /note-ui\.js\?v=\d{8}-\d+/);
  assert.match(script, /page-store\.js\?v=\d{8}-\d+/);
  assert.match(restoreUi, /restore\.js\?v=\d{8}-\d+/);
  assert.match(taskUi, /task-store\.js\?v=\d{8}-\d+/);
  assert.match(weeklyUi, /weekly-store\.js\?v=\d{8}-\d+/);
  assert.match(noteUi, /note-store\.js\?v=\d{8}-\d+/);
});
