import { getWeekStart, shiftWeek, WEEKLY_SUBJECTS } from "./src/weekly-store.js?v=20260724-1";
import {
  WEEKLY_TASK_STORAGE_KEY,
  addWeeklyTasks,
  getWeeklyTasks,
  loadWeeklyTaskStore,
  replaceStoredWeeklyTaskStore,
} from "./src/weekly-task-store.js?v=20260727-1";

const WORKER_ENDPOINT = "https://study-canvas.soutarou-naka-1016.workers.dev";
const REQUEST_TIMEOUT_MS = 45_000;
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

const weeklyButton = document.querySelector("#weeklyButton");
const pageDate = document.querySelector("#pageDate");
const previousWeekButton = document.querySelector("#previousWeekButton");
const nextWeekButton = document.querySelector("#nextWeekButton");
const currentWeekButton = document.querySelector("#currentWeekButton");
const subjectTabs = document.querySelector("#weeklySubjectTabs");
const recognitionButton = document.querySelector("#weeklyRecognitionButton");
const recognitionDialog = document.querySelector("#weeklyRecognitionDialog");
const recognitionPreview = document.querySelector("#weeklyRecognitionPreview");

if (recognitionDialog && recognitionButton && recognitionPreview && subjectTabs) {
  let activeWeekStart = getWeekStart(pageDate?.dateTime || today);
  let activeSubject = getActiveSubject();
  let candidates = [];
  let weeklyTaskStore = loadWeeklyTaskStore(localStorage.getItem(WEEKLY_TASK_STORAGE_KEY)).store;

  installRecognitionUi();
  weeklyButton?.addEventListener("click", () => {
    activeWeekStart = getWeekStart(pageDate?.dateTime || today);
    activeSubject = getActiveSubject();
  });
  previousWeekButton?.addEventListener("click", () => { activeWeekStart = shiftWeek(activeWeekStart, -1); });
  nextWeekButton?.addEventListener("click", () => { activeWeekStart = shiftWeek(activeWeekStart, 1); });
  currentWeekButton?.addEventListener("click", () => { activeWeekStart = getWeekStart(today); });
  subjectTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-weekly-subject]");
    if (button && WEEKLY_SUBJECTS.includes(button.dataset.weeklySubject)) activeSubject = button.dataset.weeklySubject;
  });
  recognitionButton.addEventListener("click", prepareDialog);

  function installRecognitionUi() {
    const placeholder = recognitionDialog.querySelector(".weekly-recognition-placeholder");
    placeholder.innerHTML = `
      <div class="weekly-ai-intro">
        <strong>手書きをAIで読み取り、週間カード候補にします</strong>
        <p>画像は「AIで読み取る」を押した時だけCloudflare Workers AIへ送信します。保存前に必ず内容を確認できます。</p>
      </div>
      <p id="weeklyRecognitionStatus" class="weekly-ai-status" role="status" aria-live="polite"></p>
      <div id="weeklyRecognitionCandidates" class="weekly-ai-candidates"></div>
      <section class="weekly-saved-cards" aria-labelledby="weeklySavedCardsTitle">
        <div class="weekly-saved-cards-header"><h3 id="weeklySavedCardsTitle">保存済みの週間カード</h3><span id="weeklySavedCardCount"></span></div>
        <div id="weeklySavedCardList" class="weekly-saved-card-list"></div>
      </section>`;

    const actions = recognitionDialog.querySelector(".weekly-recognition-actions");
    actions.insertAdjacentHTML("afterbegin", `
      <button id="weeklyAiReadButton" class="weekly-ai-primary" type="button">AIで読み取る</button>
      <button id="weeklySaveCandidatesButton" class="weekly-ai-save" type="button" disabled>選択した候補をカード化</button>`);
    recognitionDialog.querySelector("#weeklyAiReadButton").addEventListener("click", recognizeImage);
    recognitionDialog.querySelector("#weeklySaveCandidatesButton").addEventListener("click", saveSelectedCandidates);
    recognitionDialog.querySelector("#weeklyRecognitionCandidates").addEventListener("input", syncCandidateState);
    recognitionDialog.querySelector("#weeklyRecognitionCandidates").addEventListener("change", syncCandidateState);

    const style = document.createElement("style");
    style.textContent = `
      .weekly-ai-intro p{margin:6px 0 0;color:#475569}.weekly-ai-status{min-height:22px;margin:12px 0;font-weight:700}.weekly-ai-status.is-error{color:#b42318}.weekly-ai-status.is-success{color:#067647}.weekly-ai-candidates{display:grid;gap:10px}.weekly-ai-candidate{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;border:1px solid #cbd5e1;border-radius:12px;padding:10px;background:#fff}.weekly-ai-candidate input[type=text]{width:100%;min-height:42px;border:1px solid #94a3b8;border-radius:9px;padding:8px 10px;font-size:16px}.weekly-ai-confidence{font-size:12px;color:#64748b;white-space:nowrap}.weekly-ai-empty{padding:18px;border:1px dashed #94a3b8;border-radius:12px;color:#64748b;text-align:center}.weekly-ai-primary,.weekly-ai-save{font-weight:700}.weekly-ai-primary{background:#2558e6!important;color:#fff;border-color:#2558e6!important}.weekly-ai-save{background:#0f766e!important;color:#fff;border-color:#0f766e!important}.weekly-ai-save:disabled{opacity:.45}.weekly-saved-cards{margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px}.weekly-saved-cards-header{display:flex;justify-content:space-between;align-items:center;gap:12px}.weekly-saved-cards h3{margin:0;font-size:16px}.weekly-saved-card-list{display:grid;gap:8px;margin-top:10px}.weekly-saved-card{border:1px solid #cbd5e1;border-left:5px solid #2558e6;border-radius:10px;padding:10px 12px;background:#f8fafc}.weekly-saved-card small{display:block;margin-top:4px;color:#64748b}@media(max-width:620px){.weekly-ai-candidate{grid-template-columns:auto 1fr}.weekly-ai-confidence{grid-column:2}.weekly-recognition-actions{flex-wrap:wrap}.weekly-recognition-actions button{flex:1 1 42%}}`;
    document.head.append(style);
  }

  function prepareDialog() {
    activeSubject = getActiveSubject();
    candidates = [];
    setStatus("");
    renderCandidates();
    renderSavedCards();
  }

  async function recognizeImage() {
    const readButton = recognitionDialog.querySelector("#weeklyAiReadButton");
    const saveButton = recognitionDialog.querySelector("#weeklySaveCandidatesButton");
    readButton.disabled = true;
    saveButton.disabled = true;
    setStatus("手書きを読み取っています…");
    candidates = [];
    renderCandidates();

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const image = parseDataUrl(recognitionPreview.src);
      const response = await fetch(`${WORKER_ENDPOINT}/recognize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: activeSubject, weekStart: activeWeekStart, image }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || `読み取りに失敗しました（${response.status}）`);
      if (!Array.isArray(payload.tasks)) throw new Error("AIの回答形式が正しくありません");
      candidates = payload.tasks.map((task, index) => ({
        id: `candidate-${index}`,
        selected: true,
        text: String(task.text || "").trim(),
        confidence: Math.max(0, Math.min(1, Number(task.confidence) || 0)),
      })).filter((task) => task.text);
      if (candidates.length === 0) throw new Error("手書きのタスクを読み取れませんでした");
      renderCandidates();
      setStatus(`${candidates.length}件の候補を読み取りました。誤読を修正してから保存してください。`, false, true);
    } catch (error) {
      candidates = [];
      renderCandidates();
      const message = error?.name === "AbortError" ? "読み取りがタイムアウトしました。既存データは変更されていません。" : `${error?.message || "読み取りに失敗しました"}。既存データは変更されていません。`;
      setStatus(message, true);
    } finally {
      window.clearTimeout(timeout);
      readButton.disabled = false;
      syncSaveButton();
    }
  }

  function renderCandidates() {
    const container = recognitionDialog.querySelector("#weeklyRecognitionCandidates");
    if (candidates.length === 0) {
      container.innerHTML = '<div class="weekly-ai-empty">まだ候補はありません。「AIで読み取る」を押してください。</div>';
      syncSaveButton();
      return;
    }
    container.innerHTML = candidates.map((candidate, index) => `
      <label class="weekly-ai-candidate">
        <input type="checkbox" data-candidate-selected="${index}" ${candidate.selected ? "checked" : ""} aria-label="候補${index + 1}を保存対象にする" />
        <input type="text" data-candidate-text="${index}" maxlength="160" value="${escapeHtml(candidate.text)}" aria-label="候補${index + 1}の内容" />
        <span class="weekly-ai-confidence">確信度 ${Math.round(candidate.confidence * 100)}%</span>
      </label>`).join("");
    syncSaveButton();
  }

  function syncCandidateState(event) {
    const selectedIndex = event.target.dataset.candidateSelected;
    const textIndex = event.target.dataset.candidateText;
    if (selectedIndex !== undefined && candidates[selectedIndex]) candidates[selectedIndex].selected = event.target.checked;
    if (textIndex !== undefined && candidates[textIndex]) candidates[textIndex].text = event.target.value;
    syncSaveButton();
  }

  function syncSaveButton() {
    const button = recognitionDialog.querySelector("#weeklySaveCandidatesButton");
    button.disabled = !candidates.some((candidate) => candidate.selected && candidate.text.trim());
  }

  function saveSelectedCandidates() {
    const texts = candidates.filter((candidate) => candidate.selected).map((candidate) => candidate.text.trim()).filter(Boolean);
    try {
      const nextStore = addWeeklyTasks(weeklyTaskStore, activeWeekStart, activeSubject, texts);
      replaceStoredWeeklyTaskStore(localStorage, nextStore);
      weeklyTaskStore = nextStore;
      candidates = candidates.filter((candidate) => !candidate.selected);
      renderCandidates();
      renderSavedCards();
      setStatus(`${texts.length}件を${activeSubject}の週間カードとして保存しました。`, false, true);
    } catch (error) {
      setStatus(`${error?.message || "カードを保存できませんでした"}。以前の保存内容は維持されています。`, true);
    }
  }

  function renderSavedCards() {
    const tasks = getWeeklyTasks(weeklyTaskStore, activeWeekStart, activeSubject);
    recognitionDialog.querySelector("#weeklySavedCardCount").textContent = `${tasks.length}件`;
    const list = recognitionDialog.querySelector("#weeklySavedCardList");
    list.innerHTML = tasks.length > 0
      ? tasks.map((task) => `<article class="weekly-saved-card"><strong>${escapeHtml(task.text)}</strong><small>${activeSubject}・AI読み取りから保存</small></article>`).join("")
      : '<div class="weekly-ai-empty">この週・科目の保存済みカードはありません。</div>';
  }

  function getActiveSubject() {
    const selected = subjectTabs.querySelector('[data-weekly-subject][aria-selected="true"]')?.dataset.weeklySubject;
    return WEEKLY_SUBJECTS.includes(selected) ? selected : WEEKLY_SUBJECTS[0];
  }

  function parseDataUrl(value) {
    const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(value || "");
    if (!match) throw new Error("読み取り用画像を準備できませんでした");
    return { mimeType: match[1], data: match[2] };
  }

  function setStatus(text, isError = false, isSuccess = false) {
    const target = recognitionDialog.querySelector("#weeklyRecognitionStatus");
    target.textContent = text;
    target.classList.toggle("is-error", isError);
    target.classList.toggle("is-success", isSuccess && !isError);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }
}
