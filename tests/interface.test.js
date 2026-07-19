import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const script = await readFile(new URL("../script.js", import.meta.url), "utf8");
const backupScript = await readFile(new URL("../src/backup.js", import.meta.url), "utf8");

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

test("検査・プレビュー・安全コピー付きでバックアップを復元できる", () => {
  assert.match(html, /id="restoreButton"/);
  assert.match(html, /id="restoreFileInput"[^>]*type="file"/);
  assert.match(html, /id="restoreDialog"/);
  assert.match(script, /parseBackup/);
  assert.match(script, /RESTORE_SAFETY_KEY/);
  assert.match(script, /applyPendingRestore/);
});

test("今日のキャンバスへ手動タスクカードを追加できる", () => {
  assert.match(html, /id="newTaskButton"/);
  assert.match(html, /id="taskDialog"/);
  assert.match(html, /id="taskSubject"/);
  assert.match(html, /id="taskTitle"/);
  assert.match(html, /id="taskMinutes"/);
  assert.match(script, /renderTaskCards/);
  assert.match(script, /addTaskDrag/);
  assert.match(css, /\.task-card/);
});

test("週間目標は今日の計画と別の保存領域を使う", () => {
  assert.match(html, /id="weeklyModeButton"/);
  assert.match(script, /WEEKLY_STORE_KEY/);
  assert.match(script, /activeMode === "weekly"/);
  assert.doesNotMatch(script, /weekly.*addTask/i);
});

test("複数の自由ノートを名前付きで作成できる", () => {
  assert.match(html, /id="freeNoteButton"/);
  assert.match(html, /id="noteListDialog"/);
  assert.match(html, /id="newNoteTitle"/);
  assert.match(script, /NOTE_STORE_KEY/);
  assert.match(script, /createNote/);
  assert.match(script, /renderNoteList/);
});

test("公開後に更新したCSSとJavaScriptを確実に読み込む", () => {
  assert.match(html, /styles\.css\?v=\d{8}-\d+/);
  assert.match(html, /script\.js\?v=\d{8}-\d+/);
  assert.match(script, /page-store\.js\?v=\d{8}-\d+/);
});
