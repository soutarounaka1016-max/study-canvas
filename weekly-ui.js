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
  getWeekEnd,
  getWeekStart,
  getWeeklyDrawing,
  loadWeeklyStore,
  replaceStoredWeeklyStore,
  setWeeklyDrawing,
  shiftWeek,
} from "./src/weekly-store.js?v=20260720-3";
import { CanvasViewport } from "./src/canvas-viewport.js?v=20260720-5";

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
const weeklyContext = weeklyCanvas.getContext("2d", { alpha: false });

const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

const loaded = loadWeeklyStore(localStorage.getItem(WEEKLY_STORAGE_KEY), today);
let weeklyStore = loaded.store;
let activeWeekStart = getWeekStart(today);
let history = new DrawingHistory(getWeeklyDrawing(weeklyStore, activeWeekStart));
let selectedTool = "pen";
let selectedColor = "#2558e6";
let activeStroke = null;
let eraseDraft = null;
let activePointerId = null;
let frameRequest = null;
let saveTimer = null;

const viewport = new CanvasViewport(weeklyCanvasWrap, weeklyCanvasStage, {
  onGestureStart: cancelWeeklyInteraction,
});

if (loaded.recovered) showWeeklySaveError("壊れた週間データを除いて読み込みました");

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
weeklyUndoButton.addEventListener("click", () => { history.undo(); afterWeeklyChange(); });
weeklyRedoButton.addEventListener("click", () => { history.redo(); afterWeeklyChange(); });
weeklyClearButton.addEventListener("click", () => {
  if (history.current.strokes.length === 0) return;
  if (!window.confirm("この週の週間目標を白紙に戻しますか？")) return;
  history.commit(emptyDrawing(activeWeekStart));
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

function selectWeeklyTool(tool) {
  selectedTool = tool === "eraser" ? "eraser" : "pen";
  weeklyDialog.querySelectorAll("[data-weekly-tool]").forEach((button) => {
    const active = button.dataset.weeklyTool === selectedTool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function switchWeek(nextWeekStart, force = false) {
  const normalized = getWeekStart(nextWeekStart);
  if (!force && normalized === activeWeekStart) return;
  if (!saveImmediately()) return;
  activeWeekStart = normalized;
  history = new DrawingHistory(getWeeklyDrawing(weeklyStore, activeWeekStart));
  viewport.reset();
  updateWeeklyHeader();
  updateWeeklyHistoryButtons();
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
  const drawing = eraseDraft || history.current;
  for (const stroke of drawing.strokes) drawWeeklyStroke(stroke);
  if (activeStroke) drawWeeklyStroke(activeStroke);
  weeklyEmptyHint.hidden = drawing.strokes.length > 0 || Boolean(activeStroke);
}

function drawWeeklyStroke(stroke) {
  weeklyContext.strokeStyle = stroke.color;
  weeklyContext.fillStyle = stroke.color;
  weeklyContext.lineWidth = stroke.width;
  weeklyContext.lineCap = "round";
  weeklyContext.lineJoin = "round";
  if (stroke.points.length === 1) {
    weeklyContext.beginPath();
    weeklyContext.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
    weeklyContext.fill();
    return;
  }
  weeklyContext.beginPath();
  weeklyContext.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let index = 1; index < stroke.points.length - 1; index += 1) {
    const current = stroke.points[index];
    const next = stroke.points[index + 1];
    weeklyContext.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = stroke.points.at(-1);
  weeklyContext.lineTo(last.x, last.y);
  weeklyContext.stroke();
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
    const nextStore = setWeeklyDrawing(weeklyStore, activeWeekStart, history.current);
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

function formatShortDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short",
  }).format(new Date(`${date}T00:00:00+09:00`));
}

updateWeeklyHeader();
updateWeeklyHistoryButtons();
requestWeeklyRender();
