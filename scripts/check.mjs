import { readFile, stat } from "node:fs/promises";

const requiredFiles = [
  "index.html", "styles.css", "note.css", "enhancements.css", "carryover.css", "selection.css", "taskize.css",
  "script.js", "restore-ui.js", "task-ui.js", "carryover-ui.js", "weekly-ui.js", "note-ui.js", "note-selection-ui.js", "daily-enhancements.js",
  "release-entry.js", "taskize-entry.js", "taskize-ui.js", "dashboard-entry.js", "dashboard-ui.js", "dashboard-style.js",
  "home-entry.js", "home-ui.js", "home-style.js",
  "ai-recognition-entry.js", "ai-recognition-ui.js", "ai-recognition-style.js", "ai-action-ui.js",
  "full-backup-entry.js", "full-backup-ui.js", "full-backup-style.js",
  "ai-settings-ui.js", "cloudflare-worker.js", "wrangler.jsonc", "AI_SETUP.md",
  "src/drawing-model.js", "src/page-store.js", "src/backup.js", "src/restore.js", "src/task-store.js", "src/task-copy.js", "src/study-stats.js", "src/home-route.js", "src/weekly-store.js", "src/note-store.js", "src/selection-controller.js", "src/selection-dom.js", "src/ai-recognition.js",
  "AGENTS.md", "PROJECT_STATUS.md", "TODO.md", "DECISIONS.md",
];
const textFiles = [...requiredFiles, "README.md", "package.json"];
const conflictPattern = /^(<<<<<<<|=======|>>>>>>>)/m;
const secretPattern = /(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|BEGIN (RSA|OPENSSH) PRIVATE KEY)/;
let failed = false;

for (const file of requiredFiles) {
  try {
    const info = await stat(file);
    if (!info.isFile() || info.size === 0) throw new Error("空のファイルです");
  } catch (error) {
    console.error(`必須ファイルを確認できません: ${file} (${error.message})`);
    failed = true;
  }
}

for (const file of textFiles) {
  try {
    const content = await readFile(file, "utf8");
    if (conflictPattern.test(content)) {
      console.error(`コンフリクト記号が残っています: ${file}`);
      failed = true;
    }
    if (secretPattern.test(content)) {
      console.error(`秘密情報らしい文字列があります: ${file}`);
      failed = true;
    }
  } catch {
    // Missing required files are reported above.
  }
}

const html = await readFile("index.html", "utf8");
for (const reference of ["styles.css", "note.css", "script.js", "restore-ui.js", "task-ui.js", "carryover-ui.js", "weekly-ui.js", "note-ui.js", "release-entry.js"]) {
  if (!html.includes(reference)) {
    console.error(`index.htmlから${reference}が読み込まれていません`);
    failed = true;
  }
}
if (!html.includes("release-entry.js?v=20260721-3")) {
  console.error("ホーム画面向けの公開キャッシュ版へ更新されていません");
  failed = true;
}
if (!html.includes("note-ui.js?v=20260721-1")) {
  console.error("自由ノート修正版の公開キャッシュへ更新されていません");
  failed = true;
}
for (const id of ["noteSelectionHint", "noteSelectionActions", "noteDeleteSelectionButton"]) {
  if (!html.includes(`id="${id}"`)) {
    console.error(`自由ノートの初期化に必要な${id}がありません`);
    failed = true;
  }
}

const noteEntry = await readFile("note-ui.js", "utf8");
if (!noteEntry.includes("note-selection-ui.js")) {
  console.error("note-ui.jsからnote-selection-ui.jsが読み込まれていません");
  failed = true;
}

const releaseEntry = await readFile("release-entry.js", "utf8");
if (!releaseEntry.includes("daily-enhancements.js") || !releaseEntry.includes("taskize-entry.js") || !releaseEntry.includes("home-entry.js")) {
  console.error("release-entry.jsから日別拡張、タスク化、ホーム画面の入口が読み込まれていません");
  failed = true;
}

const homeEntry = await readFile("home-entry.js", "utf8");
const homeUi = await readFile("home-ui.js", "utf8");
const homeRoute = await readFile("src/home-route.js", "utf8");
if (!homeEntry.includes("home-style.js") || !homeEntry.includes("home-ui.js")) {
  console.error("ホーム画面の表示とスタイルが公開入口へ接続されていません");
  failed = true;
}
if (!homeUi.includes("data-home-route") || !homeUi.includes("homeButton") || !homeUi.includes("hashchange") || !homeUi.includes("TASK_STORAGE_KEY")) {
  console.error("ホーム画面のメニュー、戻る操作、集計表示を確認できません");
  failed = true;
}
if (!homeRoute.includes("HOME_ROUTES") || !homeRoute.includes("normalizeHomeRoute") || !homeRoute.includes("homeRouteHash")) {
  console.error("ホーム画面のURLルート定義を確認できません");
  failed = true;
}

const dashboardEntry = await readFile("dashboard-entry.js", "utf8");
if (!dashboardEntry.includes("dashboard-ui.js?v=20260721-2") || !dashboardEntry.includes("dashboard-style.js?v=20260721-2")) {
  console.error("学習時間集計ダッシュボードの公開版が更新されていません");
  failed = true;
}
if (!dashboardEntry.includes("ai-recognition-entry.js")) {
  console.error("タスク入力補助の公開入口が接続されていません");
  failed = true;
}

const dashboard = await readFile("dashboard-ui.js", "utf8");
const stats = await readFile("src/study-stats.js", "utf8");
if (!dashboard.includes("summarizeTasksForDate") || !dashboard.includes("summarizeTasksForRange") || !dashboard.includes("dashboardSubjectList")) {
  console.error("日別・週別・科目別の集計表示を確認できません");
  failed = true;
}
if (!stats.includes("getWeekRange") || !stats.includes("completedMinutes") || !stats.includes("subjectBreakdown")) {
  console.error("学習時間集計ロジックを確認できません");
  failed = true;
}
if (!dashboard.includes("実際に計測した勉強時間ではありません")) {
  console.error("完了換算時間と実測時間の区別が表示されていません");
  failed = true;
}

const taskAssist = await readFile("ai-action-ui.js", "utf8");
if (!taskAssist.includes("QUICK_SUBJECTS") || !taskAssist.includes("QUICK_MINUTES") || !taskAssist.includes("installTaskAssist")) {
  console.error("科目・予定時間のクイック入力を確認できません");
  failed = true;
}
if (/tesseract|recognizeTaskWithLocalOcr/i.test(taskAssist)) {
  console.error("停止した端末内OCRへの参照が入力補助へ残っています");
  failed = true;
}

try {
  await stat("src/local-ocr.js");
  console.error("不採用の端末内OCR本体が残っています");
  failed = true;
} catch {
  // The rejected OCR implementation must remain absent.
}

const worker = await readFile("cloudflare-worker.js", "utf8");
if (!worker.includes("gemini-2.5-flash") || !worker.includes("noPaidFallback")) {
  console.error("保留中の無料枠AI中継設定を確認できません");
  failed = true;
}

if (failed) process.exit(1);
console.log("静的アプリの構成、ホーム画面、自由ノート初期化、学習時間集計、入力補助、OCR削除、AI中継、コンフリクト記号、秘密情報を確認しました。");
