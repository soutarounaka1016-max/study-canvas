import {
  FULL_BACKUP_KEYS,
  applyFullRestore,
  createFullBackupFilename,
  parseFullBackup,
  readCurrentFullState,
  serializeFullBackup,
  summarizeFullState,
} from "./src/full-backup.js?v=20260720-12";

const backupButton = document.querySelector("#backupButton");
const restoreButton = document.querySelector("#restoreButton");
const restoreFile = document.querySelector("#restoreFile");
const backupStatus = document.querySelector("#backupStatus");
const pageDate = document.querySelector("#pageDate");
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

let pendingBackup = null;
let pendingFileName = "";
const dialog = createRestoreDialog();
document.body.append(dialog);

backupButton.textContent = "全データのバックアップを保存";
restoreButton.textContent = "統合バックアップから復元";
document.querySelectorAll(".task-backup-note, .weekly-backup-note, .note-backup-note").forEach((note) => {
  note.textContent = "このデータは統合バックアップに含まれます。";
});

backupButton.addEventListener("click", downloadCurrentBackup, { capture: true });
restoreFile.addEventListener("change", handleRestoreFile, { capture: true });

dialog.querySelector("#confirmFullRestoreButton").addEventListener("click", confirmRestore);
dialog.querySelector("#cancelFullRestoreButton").addEventListener("click", () => dialog.close());
dialog.querySelector(".dialog-close-button").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  pendingBackup = null;
  pendingFileName = "";
  restoreFile.value = "";
  setRestoreMessage("");
});

function downloadCurrentBackup(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    const state = readCurrentFullState(localStorage, pageDate.dateTime || today);
    const raw = serializeFullBackup(state);
    downloadText(raw, createFullBackupFilename(today));
    showBackupStatus("全データのバックアップを保存しました。", false);
  } catch (error) {
    showBackupStatus(error?.message || "バックアップを保存できませんでした。", true);
  }
}

async function handleRestoreFile(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const file = restoreFile.files?.[0];
  if (!file) return;

  try {
    const raw = await file.text();
    pendingBackup = parseFullBackup(raw, pageDate.dateTime || today);
    pendingFileName = file.name;
    renderRestorePreview();
    document.querySelector(".menu")?.removeAttribute("open");
    dialog.showModal();
  } catch (error) {
    pendingBackup = null;
    restoreFile.value = "";
    showBackupStatus(error?.message || "バックアップを読み込めませんでした。", true);
  }
}

function renderRestorePreview() {
  const summary = pendingBackup.summary;
  dialog.querySelector("#fullRestoreFileName").textContent = pendingFileName;
  dialog.querySelector("#fullRestoreExportedAt").textContent = formatDateTime(pendingBackup.exportedAt);
  dialog.querySelector("#fullRestoreSummary").textContent = [
    `日別 ${summary.dailyPageCount}日・${summary.dailyStrokeCount}本`,
    `タスク ${summary.taskCount}件`,
    `週間目標 ${summary.weeklyPageCount}週・${summary.weeklyStrokeCount}本`,
    `自由ノート ${summary.notePageCount}ページ・${summary.noteStrokeCount}本`,
  ].join(" / ");

  const available = new Set(pendingBackup.availableSections);
  dialog.querySelectorAll('input[name="fullRestoreSection"]').forEach((input) => {
    input.disabled = !available.has(input.value);
    input.checked = available.has(input.value);
    input.closest("label").classList.toggle("is-unavailable", input.disabled);
  });
  const legacyNote = dialog.querySelector("#legacyBackupNote");
  legacyNote.hidden = pendingBackup.format !== "legacy-pages-only";
  setRestoreMessage("");
}

function confirmRestore() {
  if (!pendingBackup) return;
  const sections = [...dialog.querySelectorAll('input[name="fullRestoreSection"]:checked')]
    .map((input) => input.value);
  if (sections.length === 0) {
    setRestoreMessage("復元する項目を一つ以上選んでください。", true);
    return;
  }

  const confirmButton = dialog.querySelector("#confirmFullRestoreButton");
  confirmButton.disabled = true;
  try {
    const currentState = readCurrentFullState(localStorage, pageDate.dateTime || today);
    const beforeRaw = serializeFullBackup(currentState);
    downloadText(beforeRaw, createFullBackupFilename(today, true));
    applyFullRestore(localStorage, pendingBackup, sections);
    setRestoreMessage("復元しました。保存内容を読み直します。", false);
    window.setTimeout(() => window.location.reload(), 550);
  } catch (error) {
    confirmButton.disabled = false;
    setRestoreMessage(error?.message || "復元できませんでした。", true);
  }
}

function createRestoreDialog() {
  const element = document.createElement("dialog");
  element.className = "full-restore-dialog";
  element.innerHTML = `
    <div class="full-restore-header">
      <div><h2>統合バックアップから復元</h2><p>選んだ項目だけを置き換えます。確定するまで現在のデータは変更しません。</p></div>
      <button class="dialog-close-button" type="button" aria-label="閉じる">×</button>
    </div>
    <dl class="full-restore-summary">
      <dt>ファイル</dt><dd id="fullRestoreFileName"></dd>
      <dt>保存日時</dt><dd id="fullRestoreExportedAt"></dd>
      <dt>内容</dt><dd id="fullRestoreSummary"></dd>
    </dl>
    <fieldset class="full-restore-sections">
      <legend>復元する項目</legend>
      <label><input type="checkbox" name="fullRestoreSection" value="pages" />日別手書き</label>
      <label><input type="checkbox" name="fullRestoreSection" value="tasks" />タスクとカード位置</label>
      <label><input type="checkbox" name="fullRestoreSection" value="weekly" />週間目標</label>
      <label><input type="checkbox" name="fullRestoreSection" value="notes" />自由ノート</label>
    </fieldset>
    <p id="legacyBackupNote" class="full-restore-note" hidden>旧形式のバックアップなので、日別手書きだけ復元できます。</p>
    <p class="full-restore-warning"><strong>復元前の現在データは、統合バックアップとして自動保存します。</strong></p>
    <p id="fullRestoreMessage" class="full-restore-message" role="status" aria-live="polite"></p>
    <div class="full-restore-actions">
      <button id="cancelFullRestoreButton" type="button">キャンセル</button>
      <button id="confirmFullRestoreButton" class="danger-button" type="button">退避して復元する</button>
    </div>
  `;
  return element;
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function showBackupStatus(text, isError) {
  backupStatus.textContent = text;
  backupStatus.classList.toggle("is-error", isError);
  backupStatus.hidden = false;
}

function setRestoreMessage(text, isError = false) {
  const target = dialog.querySelector("#fullRestoreMessage");
  target.textContent = text;
  target.classList.toggle("is-error", isError);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "不明";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

void FULL_BACKUP_KEYS;
void summarizeFullState;
