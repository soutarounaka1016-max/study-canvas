import { serializeBackup } from "./src/backup.js?v=20260719-6";
import { loadPageStore } from "./src/page-store.js?v=20260719-6";
import {
  createPreRestoreBackupFilename,
  parseBackupForRestore,
  replaceStoredPageStore,
} from "./src/restore.js?v=20260720-1";

const LEGACY_STORAGE_KEY = "study-canvas:drawing:v1";
const PAGE_STORE_KEY = "study-canvas:pages:v2";
const restoreButton = document.querySelector("#restoreButton");
const restoreFile = document.querySelector("#restoreFile");
const restoreDialog = document.querySelector("#restoreDialog");
const restoreFileName = document.querySelector("#restoreFileName");
const restoreExportedAt = document.querySelector("#restoreExportedAt");
const restorePageCount = document.querySelector("#restorePageCount");
const restoreStrokeCount = document.querySelector("#restoreStrokeCount");
const confirmRestoreButton = document.querySelector("#confirmRestoreButton");
const backupStatus = document.querySelector("#backupStatus");

const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

let pendingRestore = null;

restoreButton.addEventListener("click", () => {
  document.querySelector(".menu").removeAttribute("open");
  restoreFile.value = "";
  restoreFile.click();
});

restoreFile.addEventListener("change", async () => {
  const [file] = restoreFile.files;
  if (!file) return;

  try {
    const parsed = parseBackupForRestore(await file.text());
    pendingRestore = parsed;
    restoreFileName.textContent = file.name;
    restoreExportedAt.textContent = new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo",
    }).format(new Date(parsed.exportedAt));
    restorePageCount.textContent = `${parsed.writtenPageCount}日分`;
    restoreStrokeCount.textContent = `${parsed.strokeCount}本`;
    restoreDialog.showModal();
    showBackupStatus("内容を確認してください。まだデータは変更していません。");
  } catch (error) {
    pendingRestore = null;
    restoreFile.value = "";
    showBackupStatus(error instanceof Error ? error.message : "バックアップを読み込めませんでした");
  }
});

confirmRestoreButton.addEventListener("click", () => {
  if (!pendingRestore) return;
  confirmRestoreButton.disabled = true;

  try {
    const current = loadPageStore(
      localStorage.getItem(PAGE_STORE_KEY),
      localStorage.getItem(LEGACY_STORAGE_KEY),
      today,
    ).store;
    downloadTextFile(
      serializeBackup(current, new Date()),
      createPreRestoreBackupFilename(today),
    );
    replaceStoredPageStore(localStorage, PAGE_STORE_KEY, pendingRestore.pageStore);

    restoreDialog.close();
    showBackupStatus("復元しました。復元前の状態も別ファイルに保存しました。");
    window.setTimeout(() => window.location.reload(), 500);
  } catch (error) {
    showBackupStatus(error instanceof Error ? error.message : "復元できませんでした");
    confirmRestoreButton.disabled = false;
  }
});

restoreDialog.addEventListener("close", () => {
  pendingRestore = null;
  restoreFile.value = "";
  confirmRestoreButton.disabled = false;
});

function downloadTextFile(content, filename) {
  const blobUrl = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function showBackupStatus(message) {
  backupStatus.textContent = message;
  backupStatus.hidden = false;
}
