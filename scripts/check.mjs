import { readFile, stat } from "node:fs/promises";

const requiredFiles = [
  "index.html", "styles.css", "script.js", "restore-ui.js", "task-ui.js", "weekly-ui.js",
  "src/drawing-model.js", "src/page-store.js", "src/backup.js", "src/restore.js", "src/task-store.js", "src/weekly-store.js",
  "AGENTS.md", "PROJECT_STATUS.md", "TODO.md", "DECISIONS.md",
];
const textFiles = [...requiredFiles, "README.md", "package.json"];
const conflictPattern = /^(<<<<<<<|=======|>>>>>>>)/m;
const secretPattern = /(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|BEGIN (RSA|OPENSSH) PRIVATE KEY)/;
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
    // 必須ファイルの不足は上で報告する。
  }
}

const html = await readFile("index.html", "utf8");
for (const reference of ["styles.css", "script.js", "restore-ui.js", "task-ui.js", "weekly-ui.js"]) {
  if (!html.includes(reference)) {
    console.error(`index.htmlから${reference}が読み込まれていません`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("静的アプリの構成、コンフリクト記号、秘密情報を確認しました。");
