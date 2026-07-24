import {
  BASE_HEIGHT,
  BASE_WIDTH,
  DrawingHistory,
  cloneDrawing,
  emptyDrawing,
  strokeTouchesPoint,
} from "./src/drawing-model.js?v=20260719-6";
import {
  WEEKLY_STORAGE_KEY,
  WEEKLY_SUBJECTS,
  getWeekEnd,
  getWeekStart,
  getWeeklyDrawing,
  loadWeeklyStore,
  replaceStoredWeeklyStore,
  setWeeklyDrawing,
  shiftWeek,
} from "./src/weekly-store.js?v=20260724-1";
import { CanvasViewport } from "./src/canvas-viewport.js?v=20260720-5";
import { SelectionController } from "./src/selection-controller.js?v=20260720-9";

const pageDate = document.querySelector("#pageDate");
const weeklyButton = document.querySelector("#weeklyButton");
const weeklyDialog = document.querySelector("#weeklyDialog");
const closeWeeklyDialogButton = document.querySelector("#closeWeeklyDialogButton");
const previousWeekButton = document.querySelector("#previousWeekButton");
const nextWeekButton = document.querySelector("#nextWeekButton");
const currentWeekButton = document.querySelector("#currentWeekButton");
const weeklyRange = document.querySelector("#weeklyRange");
const weeklyCanvasWrap = document.querySelector("#weeklyCanvasWrap");
const weeklyCanvasStage = document.querySelector("#weeklyCanvasStage");
const weeklyCanvas = document.querySelector("#weeklyCanvas");
const weeklyEmptyHint = document.querySelector("#weeklyEmptyHint");
const weeklyPenWidth = document.querySelector("#weeklyPenWidth");
const weeklyUndoButton = document.querySelector("#weeklyUndoButton");
const weeklyRedoButton = document.querySelector("#weeklyRedoButton");
const weeklyClearButton = document.querySelector("#weeklyClearButton");
const weeklySaveStatus = document.querySelector("#weeklySaveStatus");
const weeklyColorOptions = weeklyDialog.querySelector(".weekly-color-options");
const weeklyWidthControl = weeklyDialog.querySelector(".weekly-width-control");
const weeklyContext = weeklyCanvas.getContext("2d", { alpha: false });

installWeeklySubjectUi();
const subjectTabs = weeklyDialog.querySelector("#weeklySubjectTabs");
const exportButton = weeklyDialog.querySelector("#weeklyExportButton");
const recognitionButton = weeklyDialog.querySelector("#weeklyRecognitionButton");
const recognitionDialog = document.querySelector("#weeklyRecognitionDialog");
const recognitionPreview = recognitionDialog.querySelector("#weeklyRecognitionPreview");
const recognitionSubject = recognitionDialog.querySelector("#weeklyRecognitionSubject");

const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

const loaded = loadWeeklyStore(localStorage.getItem(WEEKLY_STORAGE_KEY), today);
let weeklyStore = loaded.store;
let activeWeekStart = getWeekStart(today);
let activeSubject = WEEKLY_SUBJECTS[0];
let history = new DrawingHistory(getWeeklyDrawing(weeklyStore, activeWeekStart, activeSubject));
let selectedTool = "pen";
let selectedColor = "#2558e6";
let activeStroke = null;
let eraseDraft = null;
let activePointerId = null;
let frameRequest = null;
let saveTimer = null;

const selection = new SelectionController(
  () => history.current,
  (drawing) => history.commit(drawing),
);
const viewport = new CanvasViewport(weeklyCanvasWrap, weeklyCanvasStage, {
  onGestureStart: cancelWeeklyInteraction,
});

if (loaded.recovered) showWeeklySaveError("壊れた週間データを除いて読み込みました");
else if (loaded.migrated) {
  replaceStoredWeeklyStore(localStorage, WEEKLY_STORAGE_KEY, weeklyStore);
  weeklySaveStatus.textContent = "旧データを「その他」へ移行しました";
}

new ResizeObserver(resizeWeeklyCanvas).observe(weeklyCanvasWrap);

weeklyButton.addEventListener("click", () => {
  document.querySelector(".menu").removeAttribute("open");
  const requestedWeek = getWeekStart(pageDate.dateTime || today);
  switchWeek(requestedWeek, true);
  viewport.reset();
  weeklyDialog.showModal();
  requestAnimationFrame(resizeWeeklyCanvas);
});

closeWeeklyDialogButton.addEventListener("click", () => weeklyDialog.close());
weeklyDialog.addEventListener("close", saveImmediately);
previousWeekButton.addEventListener("click", () => switchWeek(shiftWeek(activeWeekStart, -1)));
nextWeekButton.addEventListener("click", () => switchWeek(shiftWeek(activeWeekStart, 1)));
currentWeekButton.addEventListener("click", () => switchWeek(getWeekStart(today)));
subjectTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-weekly-subject]");
  if (!button) return;
  switchSubject(button.dataset.weeklySubject);
});
exportButton.addEventListener("click", exportCurrentCanvas);
recognitionButton.addEventListener("click", openRecognitionPreview);
recognitionDialog.querySelectorAll("[data-close-recognition]").forEach((button) => {
  button.addEventListener("click", () => recognitionDialog.close());
});
recognitionDialog.querySelector("#weeklyRecognitionDownload").addEventListener("click", exportCurrentCanvas);

weeklyUndoButton.addEventListener("click", () => {
  history.undo();
  selection.clear();
  afterWeeklyChange();
});
weeklyRedoButton.addEventListener("click", () => {
  history.redo();
  selection.clear();
  afterWeeklyChange();
});
weeklyClearButton.addEventListener("click", () => {
  if (history.current.strokes.length === 0) return;
  if (!window.confirm(`${activeSubject}の週間目標を白紙に戻しますか？`)) return;
  history.commit(emptyDrawing(activeWeekStart));
  selection.clear();
  afterWeeklyChange();
});

weeklyDialog.querySelectorAll("[data-weekly-tool]").forEach((button) => {
  button.addEventListener("click", () => selectWeeklyTool(button.dataset.weeklyTool));
});
weeklyDialog.querySelectorAll("[data-weekly-color]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedColor = button.dataset.weeklyColor;
    weeklyDialog.querySelectorAll("[data-weekly-color]").forEach((option) => {
      const selected = option === button;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    selectWeeklyTool("pen");
  });
});

for (const eventName of ["selectstart", "contextmenu", "dblclick"]) {
  weeklyDialog.addEventListener(eventName, (event) => event.stopPropagation());
}

weeklyCanvas.addEventListener("pointerdown", handleWeeklyPointerDown);
weeklyCanvas.addEventListener("pointermove", handleWeeklyPointerMove);
weeklyCanvas.addEventListener("pointerup", finishWeeklyPointer);
weeklyCanvas.addEventListener("pointercancel", finishWeeklyPointer);
weeklyCanvas.addEventListener("lostpointercapture", finishWeeklyPointer);
window.addEventListener("pagehide", saveImmediately);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveImmediately();
});

function switchSubject(subject) {
  if (!WEEKLY_SUBJECTS.includes(subject) || subject === activeSubject) return;
  if (!saveImmediately()) return;
  activeSubject = subject;
  history = new DrawingHistory(getWeeklyDrawing(weeklyStore, activeWeekStart, activeSubject));
  selection.clear();
  viewport.reset();
  updateSubjectTabs();
  updateWeeklyHistoryButtons();
  requestWeeklyRender();
}

function switchWeek(nextWeekStart, force = false) {
  const normalized = getWeekStart(nextWeekStart);
  if (!force && normalized === activeWeekStart) return;
  if (!saveImmediately()) return;
  activeWeekStart = normalized;
  history = new DrawingHistory(getWeeklyDrawing(weeklyStore, activeWeekStart, activeSubject));
  selection.clear();
  viewport.reset();
  updateWeeklyHeader();
  updateWeeklyHistoryButtons();
  requestWeeklyRender();
}

function selectWeeklyTool(tool) {
  selectedTool = ["pen", "eraser"].includes(tool) ? tool : "pen";
  weeklyColorOptions.hidden = selectedTool !== "pen";
  weeklyWidthControl.hidden = false;
  weeklyDialog.querySelectorAll("[data-weekly-tool]").forEach((button) => {
    const active = button.dataset.weeklyTool === selectedTool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  requestWeeklyRender();
}

function handleWeeklyPointerDown(event) {
  if (viewport.pointerDown(event)) return;
  if (activePointerId !== null) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  activePointerId = event.pointerId;
  weeklyCanvas.setPointerCapture(event.pointerId);
  const point = getWeeklyCanvasPoint(event);

  if (selectedTool === "pen") {
    activeStroke = {
      id: globalThis.crypto?.randomUUID?.() || `weekly-${Date.now()}-${Math.random()}`,
      color: selectedColor,
      width: Number(weeklyPenWidth.value),
      points: [point],
    };
  } else {
    eraseDraft = cloneDrawing(history.current);
    eraseWeeklyAt(point);
  }
  requestWeeklyRender();
}

function handleWeeklyPointerMove(event) {
  if (viewport.pointerMove(event)) return;
  if (event.pointerId !== activePointerId) return;
  event.preventDefault();
  const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
  for (const currentEvent of events) {
    const point = getWeeklyCanvasPoint(currentEvent);
    if (activeStroke) {
      const previous = activeStroke.points.at(-1);
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.8) activeStroke.points.push(point);
    } else if (eraseDraft) {
      eraseWeeklyAt(point);
    }
  }
  requestWeeklyRender();
}

function finishWeeklyPointer(event) {
  if (viewport.pointerEnd(event)) return;
  if (event.pointerId !== activePointerId) return;
  let changed = false;
  if (activeStroke) {
    const nextDrawing = cloneDrawing(history.current);
    nextDrawing.strokes.push(activeStroke);
    history.commit(nextDrawing);
    changed = true;
  } else if (eraseDraft && eraseDraft.strokes.length !== history.current.strokes.length) {
    history.commit(eraseDraft);
    changed = true;
  }
  activeStroke = null;
  eraseDraft = null;
  activePointerId = null;
  if (changed) afterWeeklyChange();
  else requestWeeklyRender();
}

function cancelWeeklyInteraction() {
  const pointerId = activePointerId;
  activeStroke = null;
  eraseDraft = null;
  activePointerId = null;
  if (pointerId !== null && weeklyCanvas.hasPointerCapture(pointerId)) {
    try { weeklyCanvas.releasePointerCapture(pointerId); } catch { /* Safari may already have released it. */ }
  }
  requestWeeklyRender();
}

function eraseWeeklyAt(point) {
  const radius = 18;
  eraseDraft.strokes = eraseDraft.strokes.filter((stroke) => !strokeTouchesPoint(stroke, point, radius));
}

function getWeeklyCanvasPoint(event) {
  const rect = weeklyCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(BASE_WIDTH, ((event.clientX - rect.left) / rect.width) * BASE_WIDTH)),
    y: Math.max(0, Math.min(BASE_HEIGHT, ((event.clientY - rect.top) / rect.height) * BASE_HEIGHT)),
  };
}

function resizeWeeklyCanvas() {
  const rect = weeklyCanvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const scale = Number(weeklyCanvasStage.dataset.viewScale || 1);
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  const width = Math.max(1, Math.round((rect.width / scale) * ratio));
  const height = Math.max(1, Math.round((rect.height / scale) * ratio));
  if (weeklyCanvas.width !== width || weeklyCanvas.height !== height) {
    weeklyCanvas.width = width;
    weeklyCanvas.height = height;
  }
  renderWeeklyCanvas();
}

function requestWeeklyRender() {
  if (frameRequest !== null) return;
  frameRequest = requestAnimationFrame(() => {
    frameRequest = null;
    renderWeeklyCanvas();
  });
}

function renderWeeklyCanvas() {
  if (weeklyCanvas.width === 0 || weeklyCanvas.height === 0) return;
  weeklyContext.setTransform(1, 0, 0, 1, 0, 0);
  weeklyContext.fillStyle = "#ffffff";
  weeklyContext.fillRect(0, 0, weeklyCanvas.width, weeklyCanvas.height);
  weeklyContext.setTransform(weeklyCanvas.width / BASE_WIDTH, 0, 0, weeklyCanvas.height / BASE_HEIGHT, 0, 0);
  drawGuideLines(weeklyContext);
  const drawing = eraseDraft || history.current;
  for (const stroke of drawing.strokes) drawWeeklyStroke(weeklyContext, stroke);
  if (activeStroke) drawWeeklyStroke(weeklyContext, activeStroke);
  weeklyEmptyHint.hidden = drawing.strokes.length > 0 || Boolean(activeStroke);
  weeklyEmptyHint.textContent = `${activeSubject}の目標を1行に1つずつ書くと、あとで読み取りやすくなります`;
}

function drawGuideLines(context) {
  context.save();
  context.strokeStyle = "#e5e7eb";
  context.lineWidth = 1;
  context.setLineDash([8, 8]);
  for (let y = 110; y < BASE_HEIGHT; y += 110) {
    context.beginPath();
    context.moveTo(30, y);
    context.lineTo(BASE_WIDTH - 30, y);
    context.stroke();
  }
  context.restore();
}

function drawWeeklyStroke(context, stroke) {
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = "round";
  context.lineJoin = "round";
  if (stroke.points.length === 1) {
    context.beginPath();
    context.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }
  context.beginPath();
  context.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let index = 1; index < stroke.points.length - 1; index += 1) {
    const current = stroke.points[index];
    const next = stroke.points[index + 1];
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = stroke.points.at(-1);
  context.lineTo(last.x, last.y);
  context.stroke();
}

function afterWeeklyChange() {
  updateWeeklyHistoryButtons();
  requestWeeklyRender();
  scheduleWeeklySave();
}

function updateWeeklyHistoryButtons() {
  weeklyUndoButton.disabled = !history.canUndo;
  weeklyRedoButton.disabled = !history.canRedo;
}

function scheduleWeeklySave() {
  window.clearTimeout(saveTimer);
  weeklySaveStatus.className = "weekly-save-status is-saving";
  weeklySaveStatus.textContent = "保存中…";
  saveTimer = window.setTimeout(saveImmediately, 250);
}

function saveImmediately() {
  window.clearTimeout(saveTimer);
  try {
    const nextStore = setWeeklyDrawing(weeklyStore, activeWeekStart, activeSubject, history.current);
    replaceStoredWeeklyStore(localStorage, WEEKLY_STORAGE_KEY, nextStore);
    weeklyStore = nextStore;
    weeklySaveStatus.className = "weekly-save-status";
    weeklySaveStatus.textContent = "保存済み";
    return true;
  } catch {
    showWeeklySaveError("週間目標を保存できませんでした");
    return false;
  }
}

function showWeeklySaveError(message) {
  weeklySaveStatus.className = "weekly-save-status is-error";
  weeklySaveStatus.textContent = message;
}

function updateWeeklyHeader() {
  const end = getWeekEnd(activeWeekStart);
  weeklyRange.textContent = `${formatShortDate(activeWeekStart)} 〜 ${formatShortDate(end)}`;
  currentWeekButton.disabled = activeWeekStart === getWeekStart(today);
}

function updateSubjectTabs() {
  subjectTabs.querySelectorAll("[data-weekly-subject]").forEach((button) => {
    const active = button.dataset.weeklySubject === activeSubject;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  weeklyCanvas.setAttribute("aria-label", `${activeSubject}の週間目標を書く白いキャンバス`);
}

function exportCurrentCanvas() {
  saveImmediately();
  const image = renderExportCanvas();
  image.toBlob((blob) => {
    if (!blob) return showWeeklySaveError("画像を書き出せませんでした");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `study-canvas-${activeWeekStart}-${activeSubject}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    weeklySaveStatus.textContent = `${activeSubject}をPNGで保存しました`;
  }, "image/png");
}

function openRecognitionPreview() {
  saveImmediately();
  const image = renderExportCanvas();
  recognitionPreview.src = image.toDataURL("image/png");
  recognitionPreview.alt = `${activeSubject}の週間目標画像`;
  recognitionSubject.textContent = `${activeSubject}・${formatShortDate(activeWeekStart)}の週`;
  recognitionDialog.showModal();
}

function renderExportCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = BASE_WIDTH;
  canvas.height = BASE_HEIGHT;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
  context.fillStyle = "#111827";
  context.font = "600 28px system-ui, sans-serif";
  context.fillText(`${activeSubject}　${formatShortDate(activeWeekStart)}の週`, 32, 48);
  context.strokeStyle = "#d1d5db";
  context.lineWidth = 1;
  for (let y = 110; y < BASE_HEIGHT; y += 110) {
    context.beginPath();
    context.moveTo(30, y);
    context.lineTo(BASE_WIDTH - 30, y);
    context.stroke();
  }
  for (const stroke of history.current.strokes) drawWeeklyStroke(context, stroke);
  return canvas;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short",
  }).format(new Date(`${date}T00:00:00+09:00`));
}

function installWeeklySubjectUi() {
  const nav = weeklyDialog.querySelector(".weekly-week-nav");
  const tabs = document.createElement("div");
  tabs.id = "weeklySubjectTabs";
  tabs.className = "weekly-subject-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "週間目標の科目");
  tabs.innerHTML = WEEKLY_SUBJECTS.map((subject, index) => `<button type="button" role="tab" data-weekly-subject="${subject}" aria-selected="${index === 0}">${subject}</button>`).join("");
  nav.insertAdjacentElement("afterend", tabs);

  const toolbar = weeklyDialog.querySelector(".weekly-toolbar");
  const actions = document.createElement("div");
  actions.className = "weekly-export-actions";
  actions.innerHTML = `<button id="weeklyExportButton" type="button">画像を書き出す</button><button id="weeklyRecognitionButton" type="button">読み取り確認</button>`;
  toolbar.insertAdjacentElement("afterend", actions);

  const dialog = document.createElement("dialog");
  dialog.id = "weeklyRecognitionDialog";
  dialog.className = "weekly-recognition-dialog";
  dialog.innerHTML = `
    <div class="weekly-recognition-header"><div><h2>読み取り用画像の確認</h2><p id="weeklyRecognitionSubject"></p></div><button type="button" data-close-recognition aria-label="閉じる">×</button></div>
    <img id="weeklyRecognitionPreview" alt="" />
    <div class="weekly-recognition-placeholder">
      <strong>次の段階でここに読み取り候補を表示します</strong>
      <p>今回は科目別画像の生成と、結果を確認・修正する画面の土台まで実装しています。画像は外部へ送信しません。</p>
      <label>読み取り候補（準備中）<textarea disabled placeholder="例：青チャート 例題120〜130"></textarea></label>
    </div>
    <div class="weekly-recognition-actions"><button id="weeklyRecognitionDownload" type="button">この画像を保存</button><button type="button" data-close-recognition>閉じる</button></div>`;
  document.body.append(dialog);

  const style = document.createElement("style");
  style.textContent = `
    .weekly-subject-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:0 16px 12px}.weekly-subject-tabs button{min-height:44px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;font-weight:700}.weekly-subject-tabs button.is-active{border-color:#2558e6;background:#eaf0ff;color:#173da8}.weekly-export-actions{display:flex;gap:10px;justify-content:flex-end;padding:0 16px 10px}.weekly-export-actions button{min-height:40px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:0 14px}.weekly-export-actions #weeklyRecognitionButton{background:#2558e6;color:#fff;border-color:#2558e6}.weekly-recognition-dialog{width:min(760px,calc(100vw - 24px));max-height:calc(100vh - 24px);border:0;border-radius:16px;padding:18px}.weekly-recognition-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.weekly-recognition-header h2{margin:0}.weekly-recognition-header p{margin:6px 0 0;color:#64748b}.weekly-recognition-header button{font-size:28px;border:0;background:transparent}.weekly-recognition-dialog img{display:block;width:100%;margin:14px 0;border:1px solid #cbd5e1;border-radius:12px;background:#fff}.weekly-recognition-placeholder{border:1px dashed #94a3b8;border-radius:12px;padding:14px}.weekly-recognition-placeholder p{margin:6px 0 12px;color:#475569}.weekly-recognition-placeholder label{display:grid;gap:6px}.weekly-recognition-placeholder textarea{min-height:80px;border:1px solid #cbd5e1;border-radius:10px;padding:10px}.weekly-recognition-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}.weekly-recognition-actions button{min-height:42px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:0 14px}@media(max-width:620px){.weekly-subject-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}.weekly-export-actions{justify-content:stretch}.weekly-export-actions button{flex:1}}`;
  document.head.append(style);
}

updateWeeklyHeader();
updateSubjectTabs();
updateWeeklyHistoryButtons();
requestWeeklyRender();
