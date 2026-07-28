import { getWeekStart, shiftWeek } from "./src/weekly-store.js?v=20260724-1";
import {
  WEEKLY_CARD_STORAGE_KEY,
  addWeeklyCards,
  deleteWeeklyCard,
  getWeeklyCards,
  loadWeeklyCardStore,
  replaceStoredWeeklyCardStore,
} from "./src/weekly-card-store.js?v=20260727-1";
import { recognizeWeeklyCanvas } from "./src/weekly-recognition.js?v=20260727-1";

function installWeeklyRecognition() {
installStyle();

const weeklyButton = document.querySelector("#weeklyButton");
const weeklyDialog = document.querySelector("#weeklyDialog");
const recognitionButton = document.querySelector("#weeklyRecognitionButton");
const recognitionDialog = document.querySelector("#weeklyRecognitionDialog");
const recognitionPreview = document.querySelector("#weeklyRecognitionPreview");
const subjectTabs = document.querySelector("#weeklySubjectTabs");
const pageDate = document.querySelector("#pageDate");
const previousWeekButton = document.querySelector("#previousWeekButton");
const nextWeekButton = document.querySelector("#nextWeekButton");
const currentWeekButton = document.querySelector("#currentWeekButton");

if (!(weeklyButton && weeklyDialog && recognitionButton && recognitionDialog && recognitionPreview && subjectTabs)) {
  return false;
}

  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  let activeWeekStart = getWeekStart(pageDate?.dateTime || today);
  let activeSubject = subjectTabs.querySelector(".is-active")?.dataset.weeklySubject || "数学";
  let candidates = [];
  let cardStore = loadWeeklyCardStore(localStorage.getItem(WEEKLY_CARD_STORAGE_KEY)).store;
  const shelf = createCardShelf();
  weeklyDialog.querySelector(".weekly-export-actions")?.insertAdjacentElement("afterend", shelf);
  upgradeRecognitionDialog(recognitionDialog);
  renderShelf();

  weeklyButton.addEventListener("click", () => {
    activeWeekStart = getWeekStart(pageDate?.dateTime || today);
    queueMicrotask(renderShelf);
  });
  previousWeekButton?.addEventListener("click", () => {
    activeWeekStart = shiftWeek(activeWeekStart, -1);
    queueMicrotask(renderShelf);
  });
  nextWeekButton?.addEventListener("click", () => {
    activeWeekStart = shiftWeek(activeWeekStart, 1);
    queueMicrotask(renderShelf);
  });
  currentWeekButton?.addEventListener("click", () => {
    activeWeekStart = getWeekStart(today);
    queueMicrotask(renderShelf);
  });
  subjectTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-weekly-subject]");
    if (!button) return;
    activeSubject = button.dataset.weeklySubject;
    queueMicrotask(renderShelf);
  });
  recognitionButton.addEventListener("click", () => {
    activeSubject = subjectTabs.querySelector(".is-active")?.dataset.weeklySubject || activeSubject;
    candidates = [];
    renderCandidates();
    setRecognitionStatus("画像を確認し、「AIで読み取る」を押してください。");
  });

  recognitionDialog.querySelector("#weeklyRunRecognition")?.addEventListener("click", runRecognition);
  recognitionDialog.querySelector("#weeklyAddCandidate")?.addEventListener("click", () => {
    candidates.push({ selected: true, title: "", confidence: 0, warning: "手動追加" });
    renderCandidates();
    recognitionDialog.querySelector('.weekly-candidate-row:last-child input[type="text"]')?.focus();
  });
  recognitionDialog.querySelector("#weeklySaveCandidates")?.addEventListener("click", saveSelectedCandidates);
  recognitionDialog.querySelector("#weeklyRecognitionCandidates")?.addEventListener("input", updateCandidateFromEvent);
  recognitionDialog.querySelector("#weeklyRecognitionCandidates")?.addEventListener("change", updateCandidateFromEvent);
  recognitionDialog.querySelector("#weeklyRecognitionCandidates")?.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-candidate]");
    if (!remove) return;
    candidates.splice(Number(remove.dataset.removeCandidate), 1);
    renderCandidates();
  });
  shelf.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-weekly-card]");
    if (!button) return;
    const cardId = button.dataset.deleteWeeklyCard;
    if (!window.confirm("この週間カードを削除しますか？")) return;
    try {
      const next = deleteWeeklyCard(cardStore, activeWeekStart, activeSubject, cardId);
      replaceStoredWeeklyCardStore(localStorage, WEEKLY_CARD_STORAGE_KEY, next);
      cardStore = next;
      renderShelf();
    } catch (error) {
      setShelfStatus(error?.message || "週間カードを削除できませんでした。", true);
    }
  });

  async function runRecognition() {
    const button = recognitionDialog.querySelector("#weeklyRunRecognition");
    const beforeCandidates = candidates.map((candidate) => ({ ...candidate }));
    button.disabled = true;
    setRecognitionStatus("Workers AIで読み取っています…");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 40_000);
    try {
      const tasks = await recognizeWeeklyCanvas({
        imageDataUrl: recognitionPreview.src,
        subject: activeSubject,
        weekStart: activeWeekStart,
        signal: controller.signal,
      });
      candidates = tasks.map((task) => ({ ...task, selected: true }));
      renderCandidates();
      setRecognitionStatus(`${candidates.length}件を読み取りました。誤読を直し、カード化する項目だけ選んでください。`);
    } catch (error) {
      candidates = beforeCandidates;
      renderCandidates();
      const message = error?.name === "AbortError"
        ? "読み取りがタイムアウトしました。既存のカードは変更されていません。"
        : error?.message || "読み取れませんでした。既存のカードは変更されていません。";
      setRecognitionStatus(message, true);
    } finally {
      window.clearTimeout(timeout);
      button.disabled = false;
    }
  }

  function saveSelectedCandidates() {
    const selected = candidates.filter((candidate) => candidate.selected && candidate.title.trim());
    if (selected.length === 0) {
      setRecognitionStatus("カード化する候補を1件以上選んでください。", true);
      return;
    }
    try {
      const createdAt = new Date().toISOString();
      const cards = selected.map((candidate, index) => ({
        id: globalThis.crypto?.randomUUID?.() || `weekly-card-${Date.now()}-${index}-${Math.random()}`,
        title: candidate.title,
        confidence: candidate.confidence,
        warning: candidate.warning,
        createdAt,
        source: candidate.warning === "手動追加" ? "manual" : "ai",
      }));
      const latest = loadWeeklyCardStore(localStorage.getItem(WEEKLY_CARD_STORAGE_KEY)).store;
      const next = addWeeklyCards(latest, activeWeekStart, activeSubject, cards);
      replaceStoredWeeklyCardStore(localStorage, WEEKLY_CARD_STORAGE_KEY, next);
      cardStore = next;
      candidates = candidates.filter((candidate) => !candidate.selected);
      renderCandidates();
      renderShelf();
      setRecognitionStatus(`${cards.length}件を週間カードとして保存しました。`);
    } catch (error) {
      setRecognitionStatus(error?.message || "カードを保存できませんでした。既存のカードは変更されていません。", true);
    }
  }

  function updateCandidateFromEvent(event) {
    const row = event.target.closest("[data-candidate-index]");
    if (!row) return;
    const index = Number(row.dataset.candidateIndex);
    const candidate = candidates[index];
    if (!candidate) return;
    if (event.target.matches('input[type="checkbox"]')) candidate.selected = event.target.checked;
    if (event.target.matches('input[type="text"]')) candidate.title = event.target.value;
    updateSaveButton();
  }

  function renderCandidates() {
    const list = recognitionDialog.querySelector("#weeklyRecognitionCandidates");
    if (!list) return;
    if (candidates.length === 0) {
      list.innerHTML = '<p class="weekly-candidate-empty">読み取り候補はまだありません。</p>';
      updateSaveButton();
      return;
    }
    list.innerHTML = candidates.map((candidate, index) => `
      <div class="weekly-candidate-row" data-candidate-index="${index}">
        <label class="weekly-candidate-select"><input type="checkbox" ${candidate.selected ? "checked" : ""} /><span>カード化</span></label>
        <input type="text" maxlength="120" value="${escapeAttribute(candidate.title)}" aria-label="候補${index + 1}の内容" />
        <small>確信度 ${Math.round((Number(candidate.confidence) || 0) * 100)}%${candidate.warning ? `・${escapeHtml(candidate.warning)}` : ""}</small>
        <button type="button" data-remove-candidate="${index}">候補を削除</button>
      </div>`).join("");
    updateSaveButton();
  }

  function renderShelf() {
    cardStore = loadWeeklyCardStore(localStorage.getItem(WEEKLY_CARD_STORAGE_KEY)).store;
    const cards = getWeeklyCards(cardStore, activeWeekStart, activeSubject);
    shelf.querySelector("#weeklyCardShelfTitle").textContent = `${activeSubject}の週間カード（${cards.length}件）`;
    const list = shelf.querySelector("#weeklyCardList");
    list.innerHTML = cards.length === 0
      ? '<p class="weekly-card-empty">確定した読み取り候補がここに残ります。</p>'
      : cards.map((card) => `<article class="weekly-saved-card"><strong>${escapeHtml(card.title)}</strong>${card.warning ? `<small>${escapeHtml(card.warning)}</small>` : ""}<button type="button" data-delete-weekly-card="${escapeAttribute(card.id)}">削除</button></article>`).join("");
    setShelfStatus("");
  }

  function updateSaveButton() {
    const saveButton = recognitionDialog.querySelector("#weeklySaveCandidates");
    if (saveButton) saveButton.disabled = !candidates.some((candidate) => candidate.selected && candidate.title.trim());
  }

  function setRecognitionStatus(text, isError = false) {
    const target = recognitionDialog.querySelector("#weeklyRecognitionStatus");
    if (!target) return;
    target.textContent = text;
    target.classList.toggle("is-error", isError);
  }

  function setShelfStatus(text, isError = false) {
    const target = shelf.querySelector("#weeklyCardShelfStatus");
    target.textContent = text;
    target.classList.toggle("is-error", isError);
    target.hidden = !text;
  }
  return true;
}

function bootWeeklyRecognition() {
  if (document.documentElement.dataset.weeklyRecognitionInstalled === "true") return true;
  if (!installWeeklyRecognition()) return false;
  document.documentElement.dataset.weeklyRecognitionInstalled = "true";
  return true;
}

if (!bootWeeklyRecognition()) {
  document.addEventListener("study-canvas:weekly-ui-ready", bootWeeklyRecognition, { once: true });
}

function upgradeRecognitionDialog(dialog) {
  const placeholder = dialog.querySelector(".weekly-recognition-placeholder");
  if (!placeholder) return;
  placeholder.className = "weekly-recognition-workspace";
  placeholder.innerHTML = `
    <p class="weekly-recognition-privacy">「AIで読み取る」を押した時だけ、この画像をCloudflare Workers AIへ送信します。読み取りだけでは保存データを変更しません。</p>
    <div class="weekly-recognition-command"><button id="weeklyRunRecognition" type="button">AIで読み取る</button><button id="weeklyAddCandidate" type="button">候補を手動追加</button></div>
    <p id="weeklyRecognitionStatus" class="weekly-recognition-status" role="status" aria-live="polite"></p>
    <div id="weeklyRecognitionCandidates" class="weekly-recognition-candidates" aria-label="読み取り候補"></div>
    <button id="weeklySaveCandidates" class="weekly-save-candidates" type="button" disabled>選択した候補をカード化</button>`;
}

function createCardShelf() {
  const section = document.createElement("section");
  section.id = "weeklyCardShelf";
  section.className = "weekly-card-shelf";
  section.innerHTML = '<div class="weekly-card-shelf-header"><h3 id="weeklyCardShelfTitle">週間カード</h3><p id="weeklyCardShelfStatus" role="status" aria-live="polite" hidden></p></div><div id="weeklyCardList" class="weekly-card-list"></div>';
  return section;
}

function installStyle() {
  if (document.querySelector('link[data-weekly-recognition-style]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "weekly-recognition.css?v=20260728-2";
  link.dataset.weeklyRecognitionStyle = "true";
  document.head.append(link);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
