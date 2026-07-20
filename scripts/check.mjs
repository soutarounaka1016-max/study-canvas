import { readFile, stat } from "node:fs/promises";

const requiredFiles = [
  "index.html", "styles.css", "note.css", "enhancements.css", "carryover.css", "selection.css", "taskize.css",
  "script.js", "restore-ui.js", "task-ui.js", "carryover-ui.js", "weekly-ui.js", "note-ui.js", "note-selection-ui.js", "daily-enhancements.js",
  "taskize-entry.js", "taskize-ui.js", "ai-recognition-entry.js", "ai-recognition-ui.js", "ai-recognition-style.js", "ai-settings-ui.js", "ai-action-ui.js",
  "cloudflare-worker.js", "wrangler.jsonc", "AI_SETUP.md",
  "src/drawing-model.js", "src/page-store.js", "src/backup.js", "src/restore.js", "src/task-store.js", "src/task-copy.js", "src/weekly-store.js", "src/note-store.js", "src/selection-controller.js", "src/selection-dom.js", "src/ai-recognition.js",
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
for (const reference of ["styles.css", "note.css", "script.js", "restore-ui.js", "task-ui.js", "carryover-ui.js", "weekly-ui.js", "note-ui.js"]) {
  if (!html.includes(reference)) {
    console.error(`index.htmlから${reference}が読み込まれていません`);
    failed = true;
  }
}

const noteEntry = await readFile("note-ui.js", "utf8");
if (!noteEntry.includes("note-selection-ui.js")) {
  console.error("note-ui.jsからnote-selection-ui.jsが読み込まれていません");
  failed = true;
}

const dashboardEntry = await readFile("dashboard-entry.js", "utf8");
if (!dashboardEntry.includes("ai-recognition-entry.js")) {
  console.error("AI手書き認識の公開入口が接続されていません");
  failed = true;
}

const worker = await readFile("cloudflare-worker.js", "utf8");
if (!worker.includes("gemini-2.5-flash") || !worker.includes("noPaidFallback")) {
  console.error("無料枠専用のAI中継設定を確認できません");
  failed = true;
}

if (failed) process.exit(1);
console.log("静的アプリの構成、AI中継、コンフリクト記号、秘密情報を確認しました。");
