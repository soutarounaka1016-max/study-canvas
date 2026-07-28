import { readFile, stat } from "node:fs/promises";

const requiredFiles = [
  "index.html",
  "styles.css",
  "enhancements.css",
  "weekly-text.css",
  "weekly-text-ui.js",
  "task-ui.js",
  "release-entry.js",
  "home-entry.js",
  "home-ui.js",
  "home-style.js",
  "full-backup-entry.js",
  "full-backup-ui.js",
  "archive-banner.js",
  "archive-banner.css",
  "src/task-store.js",
  "src/weekly-store.js",
  "src/weekly-card-store.js",
  "src/full-backup.js",
  "src/home-route.js",
  "tests/e2e/app.spec.js",
  "tests/e2e/release-gate.spec.js",
  "playwright.config.js",
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  "AGENTS.md",
  "PROJECT_STATUS.md",
  "TODO.md",
  "DECISIONS.md",
];

const contents = {};
let failed = false;
for (const file of requiredFiles) {
  try {
    const info = await stat(file);
    if (!info.isFile() || info.size === 0) throw new Error("空のファイルです");
    contents[file] = await readFile(file, "utf8");
  } catch (error) {
    console.error(`必須ファイルを確認できません: ${file} (${error.message})`);
    failed = true;
  }
}

const conflictPattern = /^(<<<<<<<|=======|>>>>>>>)/m;
const secretPattern = /(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|BEGIN (RSA|OPENSSH) PRIVATE KEY)/;
for (const [file, content] of Object.entries(contents)) {
  if (conflictPattern.test(content)) {
    console.error(`コンフリクト記号が残っています: ${file}`);
    failed = true;
  }
  if (secretPattern.test(content)) {
    console.error(`秘密情報らしい文字列があります: ${file}`);
    failed = true;
  }
}

const html = contents["index.html"] || "";
for (const requirement of [
  'meta name="study-canvas-release" content="20260729-text-card-drag-1"',
  "weekly-text.css?v=20260729-1",
  "weekly-text-ui.js?v=20260729-1",
  "task-ui.js?v=20260729-1",
  "release-entry.js?v=20260729-1",
  'id="weeklySubjectGrid"',
  "教科別に1行ずつ入力",
]) {
  requireText(html, requirement, `正式HTMLに${requirement}がありません`);
}
for (const removed of [
  "weeklyRecognitionButton",
  "weekly-recognition-entry.js",
  "AIで読み取る",
  'id="taskMinutes"',
  "予定時間",
  "学習時間の集計",
  'id="weeklyCanvas"',
]) {
  rejectText(html, removed, `正式HTMLに廃止した表示または機能が残っています: ${removed}`);
}

const releaseEntry = contents["release-entry.js"] || "";
for (const requirement of [
  "daily-enhancements.js?v=20260729-1",
  "full-backup-entry.js?v=20260729-1",
  "home-entry.js?v=20260729-1",
]) {
  requireText(releaseEntry, requirement, `公開入口に${requirement}がありません`);
}
for (const removed of ["taskize", "dashboard", "ai-recognition", "weekly-recognition"]) {
  rejectText(releaseEntry, removed, `公開入口に廃止モジュールが残っています: ${removed}`);
}

const weeklyUi = contents["weekly-text-ui.js"] || "";
for (const requirement of [
  "WEEKLY_CARD_SUBJECTS",
  "split(/\\r?\\n/)",
  "addWeeklyCards",
  "updateWeeklyCard",
  "deleteWeeklyCard",
  "replaceStoredWeeklyCardStore",
  "study-canvas:weekly-cards-changed",
]) {
  requireText(weeklyUi, requirement, `週間テキスト入力に${requirement}がありません`);
}
for (const removed of ["recognizeWeeklyCanvas", "fetch(", "weeklyCanvas"]) {
  rejectText(weeklyUi, removed, `週間テキスト入力がAI・手書きへ依存しています: ${removed}`);
}

const taskUi = contents["task-ui.js"] || "";
for (const requirement of [
  "dailyWeeklyShelf",
  "daily-weekly-drag-handle",
  "is-weekly-drop-target",
  "sourceWeeklyCardId",
  "updateTaskPosition",
  "study-canvas:weekly-cards-changed",
  "getLinkedTasksForWeek",
]) {
  requireText(taskUi, requirement, `週間カードのドラッグ配置に${requirement}がありません`);
}
rejectText(taskUi, "taskMinutes", "日次タスク画面に予定時間入力が残っています");

const taskStore = contents["src/task-store.js"] || "";
requireText(taskStore, "sourceWeeklyCardId", "日次タスクへ週間カードIDを保持できません");
requireText(taskStore, 'TASK_STORAGE_KEY = "study-canvas:tasks:v1"', "既存の日次タスク保存キーが変わっています");

const weeklyStore = contents["src/weekly-card-store.js"] || "";
for (const requirement of ["updateWeeklyCard", "getWeeklyCardsForWeek", "WEEKLY_CARD_STORAGE_KEY"]) {
  requireText(weeklyStore, requirement, `週間カード保存に${requirement}がありません`);
}

const homeUi = contents["home-ui.js"] || "";
for (const removed of ["summarizeTasksForDate", "plannedMinutes", 'data-home-route="stats"', "学習時間"]) {
  rejectText(homeUi, removed, `ホームに時間集計が残っています: ${removed}`);
}
requireText(contents["home-style.js"] || "", "daily-weekly-shelf", "ホーム表示時に週間カード棚を隠す設定がありません");

const fullBackup = contents["src/full-backup.js"] || "";
for (const key of [
  '"study-canvas:pages:v2"',
  '"study-canvas:tasks:v1"',
  '"study-canvas:weekly:v1"',
  '"study-canvas:weekly-cards:v1"',
  '"study-canvas:free-note:v1"',
]) {
  requireText(fullBackup, key, `統合バックアップから${key}が失われています`);
}

const workflow = contents[".github/workflows/pages.yml"] || "";
for (const requirement of [
  "OCR_ARCHIVE_SHA: 70d17413f9bd9832ee2a6e94cb4aaaa2e79d8945",
  "fetch-depth: 0",
  "git archive",
  "_site/ocr-experiment",
  "study-canvas-ocr-archive:",
  "archive-banner.js",
  "actions/upload-pages-artifact@v4",
  "actions/deploy-pages@v4",
  "Verify published release chains",
  "release-gate-evidence",
]) {
  requireText(workflow, requirement, `Pages公開に${requirement}がありません`);
}
for (const removed of ["Verify Workers AI health", "Verify live Workers AI recognition"]) {
  rejectText(workflow, removed, `正式版の公開検査に廃止したAI試験が残っています: ${removed}`);
}

const playwrightConfig = contents["playwright.config.js"] || "";
const ci = contents[".github/workflows/ci.yml"] || "";
for (const project of ["chromium", "webkit", "ipad-portrait", "ipad-landscape"]) {
  requireText(playwrightConfig, `name: "${project}"`, `Playwrightに${project}がありません`);
  requireText(ci, `project: ${project}`, `CIに${project}がありません`);
}

const browserTests = `${contents["tests/e2e/app.spec.js"] || ""}\n${contents["tests/e2e/release-gate.spec.js"] || ""}`;
for (const requirement of [
  "@published",
  "dailyWeeklyShelf",
  "weeklySubjectGrid",
  "sourceWeeklyCardId",
  "ocr-experiment",
  "Release Gate 自由ノート",
  "confirmFullRestoreButton",
]) {
  requireText(browserTests, requirement, `ブラウザ検査に${requirement}がありません`);
}

if (failed) process.exit(1);
console.log("正式版のテキスト週間目標、ドラッグ配置、時間・AI非表示、既存保存互換、OCR観賞版、ブラウザ検査、公開構成を確認しました。");

function requireText(content, text, message) {
  if (content.includes(text)) return;
  console.error(message);
  failed = true;
}

function rejectText(content, text, message) {
  if (!content.includes(text)) return;
  console.error(message);
  failed = true;
}
