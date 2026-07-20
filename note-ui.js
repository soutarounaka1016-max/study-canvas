import {
  BASE_HEIGHT,
  BASE_WIDTH,
  DrawingHistory,
  cloneDrawing,
  emptyDrawing,
  strokeTouchesPoint,
} from "./src/drawing-model.js?v=20260719-6";
import {
  NOTE_STORAGE_KEY,
  getNoteDrawing,
  loadNoteStore,
  replaceStoredNoteStore,
  setNoteDrawing,
} from "./src/note-store.js?v=20260720-4";

const noteButton = document.querySelector("#noteButton");
const noteDialog = document.querySelector("#noteDialog");
const closeNoteDialogButton = document.querySelector("#closeNoteDialogButton");
const noteCanvasWrap = document.querySelector("#noteCanvasWrap");
const noteCanvas = document.querySelector("#noteCanvas");
const noteEmptyHint = document.querySelector("#noteEmptyHint");
const notePenWidth = document.querySelector("#notePenWidth");
const noteUndoButton = document.querySelector("#noteUndoButton");
const noteRedoButton = document.querySelector("#noteRedoButton");
const noteClearButton = document.querySelector("#noteClearButton");
const noteSaveStatus = document.querySelector("#noteSaveStatus");
const noteContext = noteCanvas.getContext("2d", { alpha: false });

const loaded = loadNoteStore(localStorage.getItem(NOTE_STORAGE_KEY));
let noteStore = loaded.store;
let history = new DrawingHistory(getNoteDrawing(noteStore));
let selectedTool = "pen";
let selectedColor = "#2558e6";
let activeStroke = null;
let eraseDraft = null;
let activePointerId = null;
let frameRequest = null;
let saveTimer = null;

if (loaded.recovered) showNoteSaveError("壊れた自由ノートの一部を除いて読み込みました");

new ResizeObserver(resizeNoteCanvas).observe(noteCanvasWrap);

noteButton.addEventListener("click", () => {
  document.querySelector(".menu").removeAttribute("open");
  noteDialog.showModal();
  requestAnimationFrame(resizeNoteCanvas);
});

closeNoteDialogButton.addEventListener("click", () => noteDialog.close());
noteDialog.addEventListener("close", saveImmediately);
noteUndoButton.addEventListener("click", () => { history.undo(); afterNoteChange(); });
noteRedoButton.addEventListener("click", () => { history.redo(); afterNoteChange(); });
noteClearButton.addEventListener("click", () => {
  if (history.current.strokes.length === 0) return;
  if (!window.confirm("自由ノートを白紙に戻しますか？")) return;
  history.commit(emptyDrawing("free-note"));
  afterNoteChange();
});

noteDialog.querySelectorAll("[data-note-tool]").forEach((button) => {
  button.addEventListener("click", () => selectNoteTool(button.dataset.noteTool));
});
noteDialog.querySelectorAll("[data-note-color]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedColor = button.dataset.noteColor;
    noteDialog.querySelectorAll("[data-note-color]").forEach((option) => {
      const selected = option === button;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    selectNoteTool("pen");
  });
});

for (const eventName of ["selectstart", "contextmenu", "dblclick"]) {
  noteDialog.addEventListener(eventName, (event) => event.stopPropagation());
}

noteCanvas.addEventListener("pointerdown", handleNotePointerDown);
noteCanvas.addEventListener("pointermove", handleNotePointerMove);
noteCanvas.addEventListener("pointerup", finishNotePointer);
noteCanvas.addEventListener("pointercancel", finishNotePointer);
noteCanvas.addEventListener("lostpointercapture", finishNotePointer);
window.addEventListener("pagehide", saveImmediately);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveImmediately();
});

function selectNoteTool(tool) {
  selectedTool = tool === "eraser" ? "eraser" : "pen";
  noteDialog.querySelectorAll("[data-note-tool]").forEach((button) => {
    const active = button.dataset.noteTool === selectedTool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function handleNotePointerDown(event) {
  if (activePointerId !== null) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  activePointerId = event.pointerId;
  noteCanvas.setPointerCapture(event.pointerId);
  const point = getNoteCanvasPoint(event);

  if (selectedTool === "pen") {
    activeStroke = {
      id: globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random()}`,
      color: selectedColor,
      width: Number(notePenWidth.value),
      points: [point],
    };
  } else {
    eraseDraft = cloneDrawing(history.current);
    eraseNoteAt(point);
  }
  requestNoteRender();
}

function handleNotePointerMove(event) {
  if (event.pointerId !== activePointerId) return;
  event.preventDefault();
  const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
  for (const currentEvent of events) {
    const point = getNoteCanvasPoint(currentEvent);
    if (activeStroke) {
      const previous = activeStroke.points.at(-1);
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.8) activeStroke.points.push(point);
    } else if (eraseDraft) {
      eraseNoteAt(point);
    }
  }
  requestNoteRender();
}

function finishNotePointer(event) {
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
  if (changed) afterNoteChange();
  else requestNoteRender();
}

function eraseNoteAt(point) {
  const radius = 18;
  eraseDraft.strokes = eraseDraft.strokes.filter((stroke) => !strokeTouchesPoint(stroke, point, radius));
}

function getNoteCanvasPoint(event) {
  const rect = noteCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(BASE_WIDTH, ((event.clientX - rect.left) / rect.width) * BASE_WIDTH)),
    y: Math.max(0, Math.min(BASE_HEIGHT, ((event.clientY - rect.top) / rect.height) * BASE_HEIGHT)),
  };
}

function resizeNoteCanvas() {
  const rect = noteCanvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (noteCanvas.width !== width || noteCanvas.height !== height) {
    noteCanvas.width = width;
    noteCanvas.height = height;
  }
  renderNoteCanvas();
}

function requestNoteRender() {
  if (frameRequest !== null) return;
  frameRequest = requestAnimationFrame(() => {
    frameRequest = null;
    renderNoteCanvas();
  });
}

function renderNoteCanvas() {
  if (noteCanvas.width === 0 || noteCanvas.height === 0) return;
  noteContext.setTransform(1, 0, 0, 1, 0, 0);
  noteContext.fillStyle = "#ffffff";
  noteContext.fillRect(0, 0, noteCanvas.width, noteCanvas.height);
  noteContext.setTransform(noteCanvas.width / BASE_WIDTH, 0, 0, noteCanvas.height / BASE_HEIGHT, 0, 0);
  const drawing = eraseDraft || history.current;
  for (const stroke of drawing.strokes) drawNoteStroke(stroke);
  if (activeStroke) drawNoteStroke(activeStroke);
  noteEmptyHint.hidden = drawing.strokes.length > 0 || Boolean(activeStroke);
}

function drawNoteStroke(stroke) {
  noteContext.strokeStyle = stroke.color;
  noteContext.fillStyle = stroke.color;
  noteContext.lineWidth = stroke.width;
  noteContext.lineCap = "round";
  noteContext.lineJoin = "round";
  if (stroke.points.length === 1) {
    noteContext.beginPath();
    noteContext.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
    noteContext.fill();
    return;
  }
  noteContext.beginPath();
  noteContext.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let index = 1; index < stroke.points.length - 1; index += 1) {
    const current = stroke.points[index];
    const next = stroke.points[index + 1];
    noteContext.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = stroke.points.at(-1);
  noteContext.lineTo(last.x, last.y);
  noteContext.stroke();
}

function afterNoteChange() {
  updateNoteHistoryButtons();
  requestNoteRender();
  scheduleNoteSave();
}

function updateNoteHistoryButtons() {
  noteUndoButton.disabled = !history.canUndo;
  noteRedoButton.disabled = !history.canRedo;
}

function scheduleNoteSave() {
  window.clearTimeout(saveTimer);
  noteSaveStatus.className = "note-save-status is-saving";
  noteSaveStatus.textContent = "保存中…";
  saveTimer = window.setTimeout(saveImmediately, 250);
}

function saveImmediately() {
  window.clearTimeout(saveTimer);
  try {
    const nextStore = setNoteDrawing(noteStore, history.current);
    replaceStoredNoteStore(localStorage, NOTE_STORAGE_KEY, nextStore);
    noteStore = nextStore;
    noteSaveStatus.className = "note-save-status";
    noteSaveStatus.textContent = "保存済み";
    return true;
  } catch {
    showNoteSaveError("自由ノートを保存できませんでした");
    return false;
  }
}

function showNoteSaveError(message) {
  noteSaveStatus.className = "note-save-status is-error";
  noteSaveStatus.textContent = message;
}

updateNoteHistoryButtons();
requestNoteRender();
