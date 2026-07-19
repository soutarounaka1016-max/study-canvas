import {
  BASE_HEIGHT,
  BASE_WIDTH,
  DrawingHistory,
  cloneDrawing,
  emptyDrawing,
  strokeTouchesPoint,
} from "./src/drawing-model.js";
import {
  getPageDrawing,
  loadPageStore,
  serializePageStore,
  setPageDrawing,
  shiftDate,
} from "./src/page-store.js";

const LEGACY_STORAGE_KEY = "study-canvas:drawing:v1";
const PAGE_STORE_KEY = "study-canvas:pages:v2";
const canvas = document.querySelector("#drawingCanvas");
const page = document.querySelector("#page");
const context = canvas.getContext("2d", { alpha: false });
const emptyHint = document.querySelector("#emptyHint");
const undoButton = document.querySelector("#undoButton");
const redoButton = document.querySelector("#redoButton");
const penWidth = document.querySelector("#penWidth");
const documentTitle = document.querySelector("#documentTitle");
const pageDate = document.querySelector("#pageDate");
const previousDateButton = document.querySelector("#previousDateButton");
const nextDateButton = document.querySelector("#nextDateButton");
const todayButton = document.querySelector("#todayButton");
const saveState = document.querySelector(".save-state");
const saveStatus = document.querySelector("#saveStatus");
const clearButton = document.querySelector("#clearButton");
const clearDialog = document.querySelector("#clearDialog");
const confirmClearButton = document.querySelector("#confirmClearButton");

const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

let pageStore;
let activeDate = today;
try {
  const loaded = loadPageStore(
    localStorage.getItem(PAGE_STORE_KEY),
    localStorage.getItem(LEGACY_STORAGE_KEY),
    today,
  );
  pageStore = loaded.store;
  if (loaded.migrated) localStorage.setItem(PAGE_STORE_KEY, serializePageStore(pageStore));
  if (loaded.recovered) showSaveError("旧データから復旧しました");
} catch {
  pageStore = loadPageStore(null, null, today).store;
  showSaveError("保存データを読み込めませんでした");
}

let history = new DrawingHistory(getPageDrawing(pageStore, activeDate));
let selectedTool = "pen";
let selectedColor = "#2558e6";
let activeStroke = null;
let eraseDraft = null;
let activePointerId = null;
let frameRequest = null;
let saveTimer = null;

new ResizeObserver(resizeCanvas).observe(page);

document.querySelectorAll("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => selectTool(button.dataset.tool));
});

document.querySelectorAll("[data-color]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedColor = button.dataset.color;
    document.querySelectorAll("[data-color]").forEach((option) => {
      const selected = option === button;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    selectTool("pen");
  });
});

previousDateButton.addEventListener("click", () => switchDate(shiftDate(activeDate, -1)));
nextDateButton.addEventListener("click", () => switchDate(shiftDate(activeDate, 1)));
todayButton.addEventListener("click", () => switchDate(today));
undoButton.addEventListener("click", () => { history.undo(); afterDocumentChange(); });
redoButton.addEventListener("click", () => { history.redo(); afterDocumentChange(); });

clearButton.addEventListener("click", () => {
  document.querySelector(".menu").removeAttribute("open");
  clearDialog.showModal();
});

confirmClearButton.addEventListener("click", () => {
  if (history.current.strokes.length === 0) return;
  history.commit(emptyDrawing(activeDate));
  afterDocumentChange();
});

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", finishPointer);
canvas.addEventListener("pointercancel", finishPointer);
canvas.addEventListener("lostpointercapture", finishPointer);
document.addEventListener("dblclick", (event) => event.preventDefault(), { passive: false });
window.addEventListener("pagehide", saveImmediately);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveImmediately();
});

function selectTool(tool) {
  selectedTool = tool;
  page.classList.toggle("is-viewing", tool === "view");
  document.querySelectorAll("[data-tool]").forEach((button) => {
    const active = button.dataset.tool === tool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function switchDate(nextDate) {
  if (nextDate === activeDate || activePointerId !== null) return;
  if (!saveImmediately()) return;
  activeDate = nextDate;
  history = new DrawingHistory(getPageDrawing(pageStore, activeDate));
  updateDateDisplay();
  updateHistoryButtons();
  requestRender();
}

function updateDateDisplay() {
  const value = new Date(`${activeDate}T00:00:00+09:00`);
  documentTitle.textContent = activeDate === today ? "今日の計画" : "この日の計画";
  pageDate.dateTime = activeDate;
  pageDate.textContent = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(value);
  todayButton.disabled = activeDate === today;
}

function handlePointerDown(event) {
  if (selectedTool === "view" || activePointerId !== null) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  activePointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  const point = getCanvasPoint(event);

  if (selectedTool === "pen") {
    activeStroke = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      color: selectedColor,
      width: Number(penWidth.value),
      points: [point],
    };
  } else if (selectedTool === "eraser") {
    eraseDraft = cloneDrawing(history.current);
    eraseAt(point);
  }
  requestRender();
}

function handlePointerMove(event) {
  if (event.pointerId !== activePointerId) return;
  event.preventDefault();
  const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
  for (const currentEvent of events) {
    const point = getCanvasPoint(currentEvent);
    if (activeStroke) {
      const previous = activeStroke.points.at(-1);
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.8) activeStroke.points.push(point);
    } else if (eraseDraft) {
      eraseAt(point);
    }
  }
  requestRender();
}

function finishPointer(event) {
  if (event.pointerId !== activePointerId) return;
  if (activeStroke) {
    const nextDrawing = cloneDrawing(history.current);
    nextDrawing.strokes.push(activeStroke);
    history.commit(nextDrawing);
  } else if (eraseDraft && eraseDraft.strokes.length !== history.current.strokes.length) {
    history.commit(eraseDraft);
  }
  activeStroke = null;
  eraseDraft = null;
  activePointerId = null;
  afterDocumentChange();
}

function eraseAt(point) {
  const radius = 18;
  eraseDraft.strokes = eraseDraft.strokes.filter((stroke) => !strokeTouchesPoint(stroke, point, radius));
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(BASE_WIDTH, ((event.clientX - rect.left) / rect.width) * BASE_WIDTH)),
    y: Math.max(0, Math.min(BASE_HEIGHT, ((event.clientY - rect.top) / rect.height) * BASE_HEIGHT)),
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  render();
}

function requestRender() {
  if (frameRequest !== null) return;
  frameRequest = requestAnimationFrame(() => { frameRequest = null; render(); });
}

function render() {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(canvas.width / BASE_WIDTH, 0, 0, canvas.height / BASE_HEIGHT, 0, 0);

  const drawing = eraseDraft || history.current;
  for (const stroke of drawing.strokes) drawStroke(stroke);
  if (activeStroke) drawStroke(activeStroke);
  emptyHint.hidden = drawing.strokes.length > 0 || Boolean(activeStroke);
}

function drawStroke(stroke) {
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

function afterDocumentChange() {
  updateHistoryButtons();
  requestRender();
  scheduleSave();
}
function updateHistoryButtons() {
  undoButton.disabled = !history.canUndo;
  redoButton.disabled = !history.canRedo;
}
function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveState.className = "save-state is-saving";
  saveStatus.textContent = "保存中…";
  saveTimer = window.setTimeout(saveImmediately, 250);
}
function saveImmediately() {
  window.clearTimeout(saveTimer);
  try {
    pageStore = setPageDrawing(pageStore, activeDate, history.current);
    localStorage.setItem(PAGE_STORE_KEY, serializePageStore(pageStore));
    saveState.className = "save-state";
    saveStatus.textContent = "保存済み";
    return true;
  } catch {
    showSaveError("保存できませんでした");
    return false;
  }
}
function showSaveError(message) {
  saveState.className = "save-state is-error";
  saveStatus.textContent = message;
}

updateDateDisplay();
updateHistoryButtons();
requestRender();
