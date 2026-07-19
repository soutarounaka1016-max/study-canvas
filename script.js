import {
  BASE_HEIGHT,
  BASE_WIDTH,
  DrawingHistory,
  cloneDrawing,
  deleteSelectedStrokes,
  emptyDrawing,
  getSelectedStrokeBounds,
  moveSelectedStrokes,
  scaleSelectedStrokes,
  selectStrokeIdsByLasso,
  strokeTouchesPoint,
} from "./src/drawing-model.js?v=20260719-4";
import {
  getPageDrawing,
  listWrittenPageDates,
  loadPageStore,
  serializePageStore,
  setPageDrawing,
  shiftDate,
} from "./src/page-store.js?v=20260719-4";

const LEGACY_STORAGE_KEY = "study-canvas:drawing:v1";
const PAGE_STORE_KEY = "study-canvas:pages:v2";
const canvas = document.querySelector("#drawingCanvas");
const page = document.querySelector("#page");
const context = canvas.getContext("2d", { alpha: false });
const emptyHint = document.querySelector("#emptyHint");
const undoButton = document.querySelector("#undoButton");
const redoButton = document.querySelector("#redoButton");
const penWidth = document.querySelector("#penWidth");
const colorOptions = document.querySelector(".color-options");
const widthControl = document.querySelector(".width-control");
const selectionHint = document.querySelector("#selectionHint");
const selectionDeleteButton = document.querySelector("#selectionDeleteButton");
const documentTitle = document.querySelector("#documentTitle");
const pageDate = document.querySelector("#pageDate");
const previousDateButton = document.querySelector("#previousDateButton");
const nextDateButton = document.querySelector("#nextDateButton");
const todayButton = document.querySelector("#todayButton");
const pageListButton = document.querySelector("#pageListButton");
const pageListDialog = document.querySelector("#pageListDialog");
const closePageListButton = document.querySelector("#closePageListButton");
const pageList = document.querySelector("#pageList");
const emptyPageList = document.querySelector("#emptyPageList");
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
let lassoPoints = null;
let selectedStrokeIds = new Set();
let selectionDrag = null;
let selectionResize = null;
let selectionDraft = null;
let selectionActionsVisible = false;
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
pageListButton.addEventListener("click", openPageList);
closePageListButton.addEventListener("click", () => pageListDialog.close());
undoButton.addEventListener("click", () => { history.undo(); clearSelection(); afterDocumentChange(); });
redoButton.addEventListener("click", () => { history.redo(); clearSelection(); afterDocumentChange(); });
selectionDeleteButton.addEventListener("click", deleteSelection);

clearButton.addEventListener("click", () => {
  document.querySelector(".menu").removeAttribute("open");
  clearDialog.showModal();
});

confirmClearButton.addEventListener("click", () => {
  if (history.current.strokes.length === 0) return;
  history.commit(emptyDrawing(activeDate));
  clearSelection();
  afterDocumentChange();
});

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", finishPointer);
canvas.addEventListener("pointercancel", finishPointer);
canvas.addEventListener("lostpointercapture", finishPointer);
document.addEventListener("dblclick", (event) => event.preventDefault(), { passive: false });
document.addEventListener("selectstart", (event) => event.preventDefault());
document.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("pagehide", saveImmediately);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveImmediately();
});

function selectTool(tool) {
  if (tool !== selectedTool) clearSelection();
  selectedTool = tool;
  page.classList.toggle("is-viewing", tool === "view");
  const selecting = tool === "select";
  colorOptions.hidden = selecting;
  widthControl.hidden = selecting;
  selectionHint.hidden = !selecting;
  updateSelectionHint();
  document.querySelectorAll("[data-tool]").forEach((button) => {
    const active = button.dataset.tool === tool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function switchDate(nextDate) {
  if (nextDate === activeDate || activePointerId !== null) return;
  if (!saveImmediately()) return;
  clearSelection();
  activeDate = nextDate;
  history = new DrawingHistory(getPageDrawing(pageStore, activeDate));
  updateDateDisplay();
  updateHistoryButtons();
  requestRender();
}

function openPageList() {
  if (!saveImmediately()) return;
  renderPageList();
  pageListDialog.showModal();
}

function renderPageList() {
  pageList.replaceChildren();
  const dates = listWrittenPageDates(pageStore);
  emptyPageList.hidden = dates.length > 0;

  for (const date of dates) {
    const drawing = getPageDrawing(pageStore, date);
    const button = document.createElement("button");
    const thumbnail = document.createElement("canvas");
    const dateLabel = document.createElement("span");
    const strokeLabel = document.createElement("small");

    button.type = "button";
    button.className = "page-card";
    button.classList.toggle("is-current", date === activeDate);
    button.setAttribute("aria-label", `${formatDate(date)}のページを開く`);
    thumbnail.width = 300;
    thumbnail.height = 200;
    thumbnail.setAttribute("aria-hidden", "true");
    dateLabel.className = "page-card-date";
    dateLabel.textContent = date === today ? `今日・${formatDate(date)}` : formatDate(date);
    strokeLabel.textContent = `${drawing.strokes.length}本の手書き`;

    drawThumbnail(thumbnail, drawing);
    button.append(thumbnail, dateLabel, strokeLabel);
    button.addEventListener("click", () => {
      switchDate(date);
      pageListDialog.close();
    });
    pageList.append(button);
  }
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00+09:00`));
}

function updateDateDisplay() {
  documentTitle.textContent = activeDate === today ? "今日の計画" : "この日の計画";
  pageDate.dateTime = activeDate;
  pageDate.textContent = formatDate(activeDate);
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
  } else if (selectedTool === "select") {
    const bounds = getSelectedStrokeBounds(history.current, selectedStrokeIds);
    const resizeHandle = bounds ? getResizeHandleAtPoint(bounds, point) : null;
    if (resizeHandle) {
      selectionActionsVisible = false;
      selectionResize = {
        ...resizeHandle,
        start: point,
        drawing: cloneDrawing(history.current),
        moved: false,
      };
      selectionDraft = cloneDrawing(history.current);
    } else if (bounds && pointInsideBounds(point, bounds, 24)) {
      selectionActionsVisible = false;
      selectionDrag = { start: point, drawing: cloneDrawing(history.current), moved: false };
      selectionDraft = cloneDrawing(history.current);
    } else {
      selectedStrokeIds = new Set();
      lassoPoints = [point];
      updateSelectionHint();
    }
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
    } else if (lassoPoints) {
      const previous = lassoPoints.at(-1);
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) lassoPoints.push(point);
    } else if (selectionResize) {
      const handleX = selectionResize.handle.x - selectionResize.anchor.x;
      const handleY = selectionResize.handle.y - selectionResize.anchor.y;
      const handleLengthSquared = handleX * handleX + handleY * handleY;
      const movedX = point.x - selectionResize.start.x;
      const movedY = point.y - selectionResize.start.y;
      const scale = handleLengthSquared > 0
        ? 1 + (movedX * handleX + movedY * handleY) / handleLengthSquared
        : 1;
      selectionResize.moved = selectionResize.moved ||
        Math.hypot(movedX, movedY) >= 0.8;
      selectionDraft = scaleSelectedStrokes(
        selectionResize.drawing,
        selectedStrokeIds,
        selectionResize.anchor,
        scale,
      );
    } else if (selectionDrag) {
      const dx = point.x - selectionDrag.start.x;
      const dy = point.y - selectionDrag.start.y;
      selectionDrag.moved = selectionDrag.moved || Math.hypot(dx, dy) >= 0.8;
      selectionDraft = moveSelectedStrokes(selectionDrag.drawing, selectedStrokeIds, dx, dy);
    }
  }
  requestRender();
}

function finishPointer(event) {
  if (event.pointerId !== activePointerId) return;
  let documentChanged = false;
  if (activeStroke) {
    const nextDrawing = cloneDrawing(history.current);
    nextDrawing.strokes.push(activeStroke);
    history.commit(nextDrawing);
    documentChanged = true;
  } else if (eraseDraft && eraseDraft.strokes.length !== history.current.strokes.length) {
    history.commit(eraseDraft);
    documentChanged = true;
  } else if (lassoPoints) {
    selectedStrokeIds = new Set(selectStrokeIdsByLasso(history.current, lassoPoints));
  } else if (selectionDrag?.moved && selectionDraft) {
    history.commit(selectionDraft);
    documentChanged = true;
  } else if (selectionResize?.moved && selectionDraft) {
    history.commit(selectionDraft);
    documentChanged = true;
  } else if (selectionDrag && !selectionDrag.moved) {
    selectionActionsVisible = true;
  }
  activeStroke = null;
  eraseDraft = null;
  lassoPoints = null;
  selectionDrag = null;
  selectionResize = null;
  selectionDraft = null;
  activePointerId = null;
  updateSelectionHint();
  if (documentChanged) afterDocumentChange();
  else requestRender();
}

function eraseAt(point) {
  const radius = 18;
  eraseDraft.strokes = eraseDraft.strokes.filter((stroke) => !strokeTouchesPoint(stroke, point, radius));
}

function deleteSelection() {
  if (selectedStrokeIds.size === 0) return;
  const nextDrawing = deleteSelectedStrokes(history.current, selectedStrokeIds);
  history.commit(nextDrawing);
  clearSelection();
  afterDocumentChange();
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(BASE_WIDTH, ((event.clientX - rect.left) / rect.width) * BASE_WIDTH)),
    y: Math.max(0, Math.min(BASE_HEIGHT, ((event.clientY - rect.top) / rect.height) * BASE_HEIGHT)),
  };
}

function pointInsideBounds(point, bounds, padding = 0) {
  return point.x >= bounds.minX - padding && point.x <= bounds.maxX + padding &&
    point.y >= bounds.minY - padding && point.y <= bounds.maxY + padding;
}

function getResizeHandles(bounds) {
  const padding = 14;
  const minimumX = Math.max(12, bounds.minX - padding);
  const minimumY = Math.max(12, bounds.minY - padding);
  const maximumX = Math.min(BASE_WIDTH - 12, bounds.maxX + padding);
  const maximumY = Math.min(BASE_HEIGHT - 12, bounds.maxY + padding);
  return [
    { corner: "north-west", handle: { x: minimumX, y: minimumY }, anchor: { x: bounds.maxX, y: bounds.maxY } },
    { corner: "north-east", handle: { x: maximumX, y: minimumY }, anchor: { x: bounds.minX, y: bounds.maxY } },
    { corner: "south-east", handle: { x: maximumX, y: maximumY }, anchor: { x: bounds.minX, y: bounds.minY } },
    { corner: "south-west", handle: { x: minimumX, y: maximumY }, anchor: { x: bounds.maxX, y: bounds.minY } },
  ];
}

function getResizeHandleAtPoint(bounds, point) {
  return getResizeHandles(bounds).find(({ handle }) => Math.hypot(point.x - handle.x, point.y - handle.y) <= 32) || null;
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

  const drawing = eraseDraft || selectionDraft || history.current;
  for (const stroke of drawing.strokes) drawStroke(context, stroke);
  if (activeStroke) drawStroke(context, activeStroke);
  drawSelectionOverlay(drawing);
  updateSelectionActions(drawing);
  emptyHint.hidden = drawing.strokes.length > 0 || Boolean(activeStroke);
}

function updateSelectionActions(drawing) {
  const bounds = getSelectedStrokeBounds(drawing, selectedStrokeIds);
  const visible = selectionActionsVisible && Boolean(bounds);
  selectionDeleteButton.hidden = !visible;
  if (!visible) return;
  const padding = 14;
  const left = Math.max(0, Math.min(BASE_WIDTH, bounds.maxX + padding));
  const top = Math.max(0, Math.min(BASE_HEIGHT, bounds.minY - padding));
  selectionDeleteButton.style.left = `${(left / BASE_WIDTH) * 100}%`;
  selectionDeleteButton.style.top = `${(top / BASE_HEIGHT) * 100}%`;
  selectionDeleteButton.style.transform = top < 60 ? "translate(-100%, 0)" : "translate(-100%, -100%)";
}

function drawSelectionOverlay(drawing) {
  context.save();
  context.strokeStyle = "#2558e6";
  context.fillStyle = "rgb(37 88 230 / 8%)";
  context.lineWidth = 3;
  context.setLineDash([12, 8]);

  if (lassoPoints?.length) {
    context.beginPath();
    context.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    for (const point of lassoPoints.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
  }

  const bounds = getSelectedStrokeBounds(drawing, selectedStrokeIds);
  if (bounds) {
    const padding = 14;
    const x = bounds.minX - padding;
    const y = bounds.minY - padding;
    const width = bounds.maxX - bounds.minX + padding * 2;
    const height = bounds.maxY - bounds.minY + padding * 2;
    context.fillRect(x, y, width, height);
    context.strokeRect(x, y, width, height);
    context.setLineDash([]);
    for (const { handle } of getResizeHandles(bounds)) drawSelectionHandle(handle);
  }
  context.restore();
}

function drawSelectionHandle(point) {
  context.beginPath();
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#2558e6";
  context.lineWidth = 5;
  context.arc(point.x, point.y, 12, 0, Math.PI * 2);
  context.fill();
  context.stroke();
}

function drawThumbnail(thumbnail, drawing) {
  const thumbnailContext = thumbnail.getContext("2d", { alpha: false });
  thumbnailContext.fillStyle = "#ffffff";
  thumbnailContext.fillRect(0, 0, thumbnail.width, thumbnail.height);
  thumbnailContext.setTransform(thumbnail.width / BASE_WIDTH, 0, 0, thumbnail.height / BASE_HEIGHT, 0, 0);
  for (const stroke of drawing.strokes) drawStroke(thumbnailContext, stroke);
}

function drawStroke(targetContext, stroke) {
  targetContext.strokeStyle = stroke.color;
  targetContext.fillStyle = stroke.color;
  targetContext.lineWidth = stroke.width;
  targetContext.lineCap = "round";
  targetContext.lineJoin = "round";
  if (stroke.points.length === 1) {
    targetContext.beginPath();
    targetContext.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
    targetContext.fill();
    return;
  }
  targetContext.beginPath();
  targetContext.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let index = 1; index < stroke.points.length - 1; index += 1) {
    const current = stroke.points[index];
    const next = stroke.points[index + 1];
    targetContext.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = stroke.points.at(-1);
  targetContext.lineTo(last.x, last.y);
  targetContext.stroke();
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

function clearSelection() {
  selectedStrokeIds = new Set();
  lassoPoints = null;
  selectionDrag = null;
  selectionResize = null;
  selectionDraft = null;
  selectionActionsVisible = false;
  updateSelectionHint();
}

function updateSelectionHint() {
  if (!selectionHint) return;
  selectionHint.textContent = selectedStrokeIds.size > 0
    ? `${selectedStrokeIds.size}本を選択中。枠内で移動、四隅の丸で拡大・縮小できます`
    : "手書きを囲んで選択してください";
}

updateDateDisplay();
updateHistoryButtons();
requestRender();
