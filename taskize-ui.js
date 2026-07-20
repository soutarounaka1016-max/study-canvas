import { getPageDrawing, loadPageStore } from "./src/page-store.js?v=20260719-6";
import {
  getWeekStart,
  getWeeklyDrawing,
  loadWeeklyStore,
  shiftWeek,
} from "./src/weekly-store.js?v=20260720-3";
import { getNoteDrawing, loadNoteStore } from "./src/note-store.js?v=20260720-6";
import {
  TASK_STORAGE_KEY,
  loadTaskStore,
  replaceStoredTaskStore,
} from "./src/task-store.js?v=20260720-7";
import {
  addTaskFromHandwriting,
  selectDrawingByLasso,
} from "./src/taskize-model.js?v=20260720-10";
import {
  TASKIZE_CANVAS_SIZE,
  drawLassoOverlay,
  getCanvasPoint,
  renderDrawingPreview,
} from "./src/taskize-preview.js?v=20260720-10";

const PAGE_STORAGE_KEY = "study-canvas:pages:v2";
const LEGACY_STORAGE_KEY = "study-canvas:drawing:v1";
const WEEKLY_STORAGE_KEY = "study-canvas:weekly:v1";
const NOTE_STORAGE_KEY = "study-canvas:free-note:v1";
const pageDate = document.querySelector("#pageDate");
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

let activeWeeklyStart = getWeekStart(today);
let activeTaskizer = null;
let selectedDrawing = null;
let selectedSource = null;
let selectedImageDataUrl = "";

const dialog = createTaskizeDialog();
const form = dialog.querySelector("#taskizeForm");
const preview = dialog.querySelector("#taskizePreview");
const sourceLabel = dialog.querySelector("#taskizeSourceLabel");
const subjectInput = dialog.querySelector("#taskizeSubject");
const titleInput = dialog.querySelector("#taskizeTitle");
const minutesInput = dialog.querySelector("#taskizeMinutes");
const dateInput = dialog.querySelector("#taskizeDate");
const message = dialog.querySelector("#taskizeMessage");
const aiButton = dialog.querySelector("#taskizeAiButton");

document.body.append(dialog);

const taskizers = [
  createTaskizer({
    key: "daily",
    label: "タスク化",
    toolbar: document.querySelector(".tool-bar"),
    stage: document.querySelector("#dailyCanvasStage"),
    buttonClass: "tool-button",
    icon: "☑",
    getSource: getDailySource,
    restoreButton: () => document.querySelector('[data-tool="pen"]'),
  }),
  createTaskizer({
    key: "weekly",
    label: "☑ タスク化",
    toolbar: document.querySelector(".weekly-tool-group"),
    stage: document.querySelector("#weeklyCanvasStage"),
    buttonClass: "weekly-tool-button",
    getSource: getWeeklySource,
    restoreButton: () => document.querySelector('[data-weekly-tool="pen"]'),
  }),
  createTaskizer({
    key: "note",
    label: "☑ タスク化",
    toolbar: document.querySelector(".note-tool-group"),
    stage: document.querySelector("#noteCanvasStage"),
    buttonClass: "note-tool-button",
    getSource: getNoteSource,
    restoreButton: () => document.querySelector('[data-note-tool="pen"]'),
  }),
].filter(Boolean);

form.addEventListener("submit", saveTaskFromSelection);
aiButton.addEventListener("click", showAiBoundary);
dialog.addEventListener("close", hideMessage);

const weeklyButton = document.querySelector("#weeklyButton");
const previousWeekButton = document.querySelector("#previousWeekButton");
const nextWeekButton = document.querySelector("#nextWeekButton");
const currentWeekButton = document.querySelector("#currentWeekButton");
weeklyButton?.addEventListener("click", () => {
  activeWeeklyStart = getWeekStart(pageDate.dateTime || today);
  deactivateTaskizer();
});
previousWeekButton?.addEventListener("click", () => {
  activeWeeklyStart = shiftWeek(activeWeeklyStart, -1);
  deactivateTaskizer();
});
nextWeekButton?.addEventListener("click", () => {
  activeWeeklyStart = shiftWeek(activeWeeklyStart, 1);
  deactivateTaskizer();
});
currentWeekButton?.addEventListener("click", () => {
  activeWeeklyStart = getWeekStart(today);
  deactivateTaskizer();
});

document.querySelector("#backToNoteGalleryButton")?.addEventListener("click", deactivateTaskizer);
document.querySelector("#closeNoteDialogButton")?.addEventListener("click", deactivateTaskizer);
document.querySelector("#closeWeeklyDialogButton")?.addEventListener("click", deactivateTaskizer);
new MutationObserver(deactivateTaskizer).observe(pageDate, {
  attributes: true,
  attributeFilter: ["datetime"],
});

function createTaskizer(config) {
  if (!config.toolbar || !config.stage) return null;

  const button = document.createElement("button");
  button.type = "button";
  button.className = `${config.buttonClass} taskize-tool-button`;
  button.setAttribute("aria-pressed", "false");
  if (config.key === "daily") {
    const icon = document.createElement("span");
    const text = document.createElement("small");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = config.icon;
    text.textContent = config.label;
    button.append(icon, text);
  } else {
    button.textContent = config.label;
  }
  config.toolbar.append(button);

  const overlay = document.createElement("canvas");
  overlay.className = "taskize-lasso-canvas";
  overlay.width = TASKIZE_CANVAS_SIZE.width;
  overlay.height = TASKIZE_CANVAS_SIZE.height;
  overlay.hidden = true;
  overlay.setAttribute("aria-label", "タスクにする手書きを囲む");

  const guide = document.createElement("div");
  guide.className = "taskize-guide";
  guide.hidden = true;
  const guideText = document.createElement("span");
  guideText.textContent = "タスクにする手書きを囲んでください";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "キャンセル";
  guide.append(guideText, cancel);
  config.stage.append(overlay, guide);

  const state = {
    ...config,
    button,
    overlay,
    guide,
    guideText,
    points: [],
    pointerId: null,
  };

  button.addEventListener("click", () => {
    if (activeTaskizer === state) {
      deactivateTaskizer();
      return;
    }
    activateTaskizer(state);
  });
  cancel.addEventListener("click", deactivateTaskizer);
  overlay.addEventListener("pointerdown", (event) => beginLasso(state, event));
  overlay.addEventListener("pointermove", (event) => moveLasso(state, event));
  overlay.addEventListener("pointerup", (event) => finishLasso(state, event));
  overlay.addEventListener("pointercancel", (event) => cancelLasso(state, event));
  overlay.addEventListener("lostpointercapture", (event) => cancelLasso(state, event));
  return state;
}

function activateTaskizer(state) {
  deactivateTaskizer();
  const source = state.getSource();
  if (!source.drawing.strokes.length) {
    state.guideText.textContent = "手書きがないためタスク化できません";
    state.guide.hidden = false;
    window.setTimeout(() => { state.guide.hidden = true; }, 1600);
    return;
  }

  activeTaskizer = state;
  state.points = [];
  state.pointerId = null;
  state.overlay.hidden = false;
  state.guide.hidden = false;
  state.guideText.textContent = "タスクにする手書きを囲んでください";
  state.button.classList.add("is-active");
  state.button.setAttribute("aria-pressed", "true");
  clearSiblingToolStyles(state);
  drawLassoOverlay(state.overlay, []);
}

function deactivateTaskizer() {
  if (!activeTaskizer) return;
  const state = activeTaskizer;
  activeTaskizer = null;
  state.overlay.hidden = true;
  state.guide.hidden = true;
  state.points = [];
  state.pointerId = null;
  state.button.classList.remove("is-active");
  state.button.setAttribute("aria-pressed", "false");
  drawLassoOverlay(state.overlay, []);
  const restore = state.restoreButton?.();
  if (restore && !restore.classList.contains("is-active")) restore.click();
}

function clearSiblingToolStyles(state) {
  state.toolbar.querySelectorAll("button").forEach((button) => {
    if (button === state.button) return;
    button.classList.remove("is-active");
    if (button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", "false");
  });
}

function beginLasso(state, event) {
  if (state !== activeTaskizer || state.pointerId !== null) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  state.pointerId = event.pointerId;
  state.points = [getCanvasPoint(state.overlay, event)];
  state.overlay.setPointerCapture(event.pointerId);
  drawLassoOverlay(state.overlay, state.points);
}

function moveLasso(state, event) {
  if (state.pointerId !== event.pointerId) return;
  event.preventDefault();
  const point = getCanvasPoint(state.overlay, event);
  const previous = state.points.at(-1);
  if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) {
    state.points.push(point);
    drawLassoOverlay(state.overlay, state.points);
  }
}

function finishLasso(state, event) {
  if (state.pointerId !== event.pointerId) return;
  event.preventDefault();
  const points = state.points;
  state.pointerId = null;
  if (points.length < 3) {
    state.guideText.textContent = "囲むように線を引いてください";
    state.points = [];
    drawLassoOverlay(state.overlay, []);
    return;
  }

  const source = state.getSource();
  const drawing = selectDrawingByLasso(source.drawing, points);
  if (!drawing.strokes.length) {
    state.guideText.textContent = "手書きに触れるように囲んでください";
    state.points = [];
    drawLassoOverlay(state.overlay, []);
    return;
  }

  selectedDrawing = drawing;
  selectedSource = source;
  deactivateTaskizer();
  openTaskizeDialog();
}

function cancelLasso(state, event) {
  if (state.pointerId !== event.pointerId) return;
  state.pointerId = null;
  state.points = [];
  drawLassoOverlay(state.overlay, []);
}

function getDailySource() {
  const date = pageDate.dateTime || today;
  const store = loadPageStore(
    localStorage.getItem(PAGE_STORAGE_KEY),
    localStorage.getItem(LEGACY_STORAGE_KEY),
    today,
  ).store;
  return {
    kind: "daily",
    label: `${formatDate(date)}の日別計画`,
    targetDate: date,
    drawing: getPageDrawing(store, date),
  };
}

function getWeeklySource() {
  const store = loadWeeklyStore(localStorage.getItem(WEEKLY_STORAGE_KEY), today).store;
  return {
    kind: "weekly",
    label: `${formatDate(activeWeeklyStart)}からの週間目標`,
    targetDate: today,
    drawing: getWeeklyDrawing(store, activeWeeklyStart),
  };
}

function getNoteSource() {
  const store = loadNoteStore(localStorage.getItem(NOTE_STORAGE_KEY)).store;
  return {
    kind: "note",
    label: "自由ノート",
    targetDate: today,
    drawing: getNoteDrawing(store, store.activePageId),
  };
}

function openTaskizeDialog() {
  form.reset();
  subjectInput.value = "";
  minutesInput.value = "30";
  dateInput.value = selectedSource.targetDate;
  sourceLabel.textContent = `${selectedSource.label}で囲んだ手書きから作成します。`;
  renderDrawingPreview(preview, selectedDrawing);
  selectedImageDataUrl = preview.toDataURL("image/png");
  hideMessage();
  dialog.showModal();
  titleInput.focus();
}

function saveTaskFromSelection(event) {
  event.preventDefault();
  try {
    const loaded = loadTaskStore(localStorage.getItem(TASK_STORAGE_KEY));
    const nextStore = addTaskFromHandwriting(loaded.store, dateInput.value, {
      subject: subjectInput.value,
      title: titleInput.value,
      plannedMinutes: Number(minutesInput.value),
    }, createTaskId());
    replaceStoredTaskStore(localStorage, TASK_STORAGE_KEY, nextStore);
    showMessage("タスクを追加しました。画面を更新します。", false);
    form.querySelector('button[type="submit"]').disabled = true;
    window.setTimeout(() => window.location.reload(), 450);
  } catch (error) {
    const text = error?.message === "DUPLICATE_TASK"
      ? "同じ科目・内容・予定時間のタスクが、この日にはすでにあります。"
      : error?.message || "タスクを保存できませんでした。";
    showMessage(text, true);
  }
}

function showAiBoundary() {
  if (!selectedImageDataUrl.startsWith("data:image/png;base64,")) {
    showMessage("選択画像を準備できませんでした。", true);
    return;
  }
  showMessage(
    "選択画像の準備は完了しています。外部AIへの送信、APIキー、料金設定はまだ接続していません。手動入力はそのまま利用できます。",
    false,
  );
}

function createTaskizeDialog() {
  const element = document.createElement("dialog");
  element.className = "taskize-dialog";
  element.innerHTML = `
    <form id="taskizeForm" class="taskize-dialog-form">
      <div class="taskize-dialog-header">
        <div>
          <h2>手書きからタスクを作成</h2>
          <p id="taskizeSourceLabel"></p>
        </div>
        <button class="dialog-close-button" type="button" aria-label="閉じる">×</button>
      </div>
      <canvas id="taskizePreview" class="taskize-preview" width="720" height="220" aria-label="選択した手書きのプレビュー"></canvas>
      <div class="taskize-ai-panel">
        <button id="taskizeAiButton" type="button">AIで読み取る</button>
        <p>AI接続前でも、下の項目を入力してタスクを作成できます。外部送信はまだ行いません。</p>
      </div>
      <div class="taskize-fields">
        <label><span>科目</span><select id="taskizeSubject" required><option value="" selected disabled>選択</option><option>数学</option><option>英語</option><option>物理</option><option>化学</option><option>国語</option><option>その他</option></select></label>
        <label class="taskize-title-field"><span>勉強内容</span><input id="taskizeTitle" type="text" maxlength="120" autocomplete="off" required /></label>
        <label><span>予定時間</span><input id="taskizeMinutes" type="number" min="5" max="600" step="5" value="30" inputmode="numeric" required /></label>
        <label><span>追加する日</span><input id="taskizeDate" type="date" required /></label>
      </div>
      <p id="taskizeMessage" class="taskize-message" role="status" aria-live="polite" hidden></p>
      <div class="taskize-dialog-actions">
        <button class="taskize-cancel-button" type="button">キャンセル</button>
        <button class="taskize-primary-button" type="submit">タスクを追加</button>
      </div>
    </form>
  `;
  element.querySelector(".dialog-close-button").addEventListener("click", () => element.close());
  element.querySelector(".taskize-cancel-button").addEventListener("click", () => element.close());
  return element;
}

function showMessage(text, isError) {
  message.textContent = text;
  message.classList.toggle("is-error", isError);
  message.hidden = false;
}

function hideMessage() {
  message.textContent = "";
  message.classList.remove("is-error");
  message.hidden = true;
  const submit = form?.querySelector('button[type="submit"]');
  if (submit) submit.disabled = false;
}

function createTaskId() {
  return globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00+09:00`));
}

void taskizers;
