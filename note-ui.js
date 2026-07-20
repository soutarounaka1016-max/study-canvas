import { BASE_HEIGHT, BASE_WIDTH, DrawingHistory, cloneDrawing, emptyDrawing, strokeTouchesPoint } from "./src/drawing-model.js?v=20260719-6";
import { NOTE_STORAGE_KEY, addNotePage, deleteNotePage, getNoteDrawing, listNotePages, loadNoteStore, renameNotePage, replaceStoredNoteStore, setActiveNotePage, setNoteDrawing } from "./src/note-store.js?v=20260720-6";
import { CanvasViewport } from "./src/canvas-viewport.js?v=20260720-5";

const $ = (selector) => document.querySelector(selector);
const noteButton = $("#noteButton");
const dialog = $("#noteDialog");
const galleryView = $("#noteGalleryView");
const editorView = $("#noteEditorView");
const gallery = $("#noteGallery");
const createButton = $("#createNoteCardButton");
const titleInput = $("#noteTitleInput");
const canvasWrap = $("#noteCanvasWrap");
const canvasStage = $("#noteCanvasStage");
const canvas = $("#noteCanvas");
const emptyHint = $("#noteEmptyHint");
const penWidth = $("#notePenWidth");
const undoButton = $("#noteUndoButton");
const redoButton = $("#noteRedoButton");
const clearButton = $("#noteClearButton");
const deleteButton = $("#deleteNotePageButton");
const saveStatus = $("#noteSaveStatus");
const context = canvas.getContext("2d", { alpha: false });

const loaded = loadNoteStore(localStorage.getItem(NOTE_STORAGE_KEY));
let store = loaded.store;
let pageId = store.activePageId;
let history = new DrawingHistory(getNoteDrawing(store, pageId));
let tool = "pen";
let color = "#2558e6";
let stroke = null;
let eraseDraft = null;
let pointerId = null;
let frame = null;
let saveTimer = null;
let dirty = false;

const viewport = new CanvasViewport(canvasWrap, canvasStage, { onGestureStart: cancelInteraction });
if (loaded.recovered) showError("壊れた自由ノートの一部を除いて読み込みました");
if (loaded.migrated) persist();
new ResizeObserver(resizeCanvas).observe(canvasWrap);

noteButton.addEventListener("click", () => {
  $(".menu").removeAttribute("open");
  showGallery();
  dialog.showModal();
});
$("#closeNoteDialogButton").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => { commitTitle(); save(); });
$("#backToNoteGalleryButton").addEventListener("click", () => { commitTitle(); if (save()) showGallery(); });
createButton.addEventListener("click", createNote);
titleInput.addEventListener("change", commitTitle);
titleInput.addEventListener("blur", commitTitle);
titleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); titleInput.blur(); }
});
undoButton.addEventListener("click", () => { history.undo(); changed(); });
redoButton.addEventListener("click", () => { history.redo(); changed(); });
clearButton.addEventListener("click", () => {
  if (!history.current.strokes.length || !window.confirm("自由ノートを白紙に戻しますか？")) return;
  history.commit(emptyDrawing(pageId));
  changed();
});
deleteButton.addEventListener("click", deleteNote);

dialog.querySelectorAll("[data-note-tool]").forEach((button) => button.addEventListener("click", () => selectTool(button.dataset.noteTool)));
dialog.querySelectorAll("[data-note-color]").forEach((button) => button.addEventListener("click", () => {
  color = button.dataset.noteColor;
  dialog.querySelectorAll("[data-note-color]").forEach((option) => {
    const selected = option === button;
    option.classList.toggle("is-selected", selected);
    option.setAttribute("aria-pressed", String(selected));
  });
  selectTool("pen");
}));
for (const name of ["selectstart", "contextmenu", "dblclick"]) dialog.addEventListener(name, (event) => event.stopPropagation());

canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
canvas.addEventListener("pointerup", pointerEnd);
canvas.addEventListener("pointercancel", pointerEnd);
canvas.addEventListener("lostpointercapture", pointerEnd);
window.addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") save(); });

function showGallery() {
  galleryView.hidden = false;
  editorView.hidden = true;
  renderGallery();
}

function showEditor(nextId, focusTitle = false) {
  if (nextId !== pageId) {
    if (!save()) return;
    store = setActiveNotePage(store, nextId);
    pageId = nextId;
    history = new DrawingHistory(getNoteDrawing(store, pageId));
    dirty = false;
    viewport.reset();
    persist();
  }
  const pages = listNotePages(store);
  titleInput.value = pages.find((page) => page.id === pageId)?.title || "自由ノート";
  deleteButton.disabled = pages.length <= 1;
  galleryView.hidden = true;
  editorView.hidden = false;
  updateHistoryButtons();
  requestRender();
  requestAnimationFrame(() => {
    resizeCanvas();
    if (focusTitle) { titleInput.focus(); titleInput.select(); }
  });
}

function renderGallery() {
  const pages = [...listNotePages(store)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  gallery.replaceChildren(createButton);
  for (const page of pages) {
    const button = document.createElement("button");
    const preview = document.createElement("canvas");
    const title = document.createElement("strong");
    const updated = document.createElement("time");
    button.type = "button";
    button.className = "note-gallery-card";
    button.classList.toggle("is-current", page.id === pageId);
    button.setAttribute("aria-label", `${page.title}を開く`);
    preview.width = 300;
    preview.height = 200;
    preview.setAttribute("aria-hidden", "true");
    title.textContent = page.title;
    updated.dateTime = page.updatedAt;
    updated.textContent = formatDate(page.updatedAt);
    drawThumbnail(preview, getNoteDrawing(store, page.id));
    button.append(preview, title, updated);
    button.addEventListener("click", () => showEditor(page.id));
    gallery.append(button);
  }
}

function createNote() {
  if (!save()) return;
  store = addNotePage(store);
  pageId = store.activePageId;
  history = new DrawingHistory(getNoteDrawing(store, pageId));
  dirty = false;
  viewport.reset();
  persist();
  showEditor(pageId, true);
}

function commitTitle() {
  if (editorView.hidden) return;
  const current = listNotePages(store).find((page) => page.id === pageId);
  try {
    store = renameNotePage(store, pageId, titleInput.value);
    const next = listNotePages(store).find((page) => page.id === pageId);
    titleInput.value = next?.title || current?.title || "自由ノート";
    if (next?.title !== current?.title) persist();
  } catch { showError("ノート名を保存できませんでした"); }
}

function deleteNote() {
  const pages = listNotePages(store);
  const current = pages.find((page) => page.id === pageId);
  if (pages.length <= 1 || !window.confirm(`${current?.title || "このノート"}を削除しますか？`)) return;
  store = deleteNotePage(store, pageId);
  pageId = store.activePageId;
  history = new DrawingHistory(getNoteDrawing(store, pageId));
  dirty = false;
  viewport.reset();
  persist();
  showGallery();
}

function selectTool(nextTool) {
  tool = nextTool === "eraser" ? "eraser" : "pen";
  dialog.querySelectorAll("[data-note-tool]").forEach((button) => {
    const active = button.dataset.noteTool === tool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function pointerDown(event) {
  if (viewport.pointerDown(event) || pointerId !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
  event.preventDefault();
  pointerId = event.pointerId;
  canvas.setPointerCapture(pointerId);
  const point = getPoint(event);
  if (tool === "pen") stroke = { id: globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random()}`, color, width: Number(penWidth.value), points: [point] };
  else { eraseDraft = cloneDrawing(history.current); eraseAt(point); }
  requestRender();
}

function pointerMove(event) {
  if (viewport.pointerMove(event) || event.pointerId !== pointerId) return;
  event.preventDefault();
  const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
  for (const current of events) {
    const point = getPoint(current);
    if (stroke) {
      const previous = stroke.points.at(-1);
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.8) stroke.points.push(point);
    } else if (eraseDraft) eraseAt(point);
  }
  requestRender();
}

function pointerEnd(event) {
  if (viewport.pointerEnd(event) || event.pointerId !== pointerId) return;
  let didChange = false;
  if (stroke) {
    const drawing = cloneDrawing(history.current);
    drawing.strokes.push(stroke);
    history.commit(drawing);
    didChange = true;
  } else if (eraseDraft && eraseDraft.strokes.length !== history.current.strokes.length) {
    history.commit(eraseDraft);
    didChange = true;
  }
  stroke = null;
  eraseDraft = null;
  pointerId = null;
  didChange ? changed() : requestRender();
}

function cancelInteraction() {
  const captured = pointerId;
  stroke = null;
  eraseDraft = null;
  pointerId = null;
  if (captured !== null && canvas.hasPointerCapture(captured)) {
    try { canvas.releasePointerCapture(captured); } catch { /* Safari may release first. */ }
  }
  requestRender();
}

function eraseAt(point) {
  eraseDraft.strokes = eraseDraft.strokes.filter((item) => !strokeTouchesPoint(item, point, 18));
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(BASE_WIDTH, ((event.clientX - rect.left) / rect.width) * BASE_WIDTH)),
    y: Math.max(0, Math.min(BASE_HEIGHT, ((event.clientY - rect.top) / rect.height) * BASE_HEIGHT)),
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const scale = Number(canvasStage.dataset.viewScale || 1);
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  const width = Math.max(1, Math.round((rect.width / scale) * ratio));
  const height = Math.max(1, Math.round((rect.height / scale) * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  render();
}

function requestRender() {
  if (frame !== null) return;
  frame = requestAnimationFrame(() => { frame = null; render(); });
}

function render() {
  if (!canvas.width || !canvas.height) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(canvas.width / BASE_WIDTH, 0, 0, canvas.height / BASE_HEIGHT, 0, 0);
  const drawing = eraseDraft || history.current;
  for (const item of drawing.strokes) drawStroke(context, item);
  if (stroke) drawStroke(context, stroke);
  emptyHint.hidden = drawing.strokes.length > 0 || Boolean(stroke);
}

function drawThumbnail(target, drawing) {
  const targetContext = target.getContext("2d", { alpha: false });
  targetContext.fillStyle = "#fff";
  targetContext.fillRect(0, 0, target.width, target.height);
  targetContext.setTransform(target.width / BASE_WIDTH, 0, 0, target.height / BASE_HEIGHT, 0, 0);
  for (const item of drawing.strokes) drawStroke(targetContext, item);
}

function drawStroke(target, item) {
  target.strokeStyle = item.color;
  target.fillStyle = item.color;
  target.lineWidth = item.width;
  target.lineCap = "round";
  target.lineJoin = "round";
  if (item.points.length === 1) {
    target.beginPath();
    target.arc(item.points[0].x, item.points[0].y, item.width / 2, 0, Math.PI * 2);
    target.fill();
    return;
  }
  target.beginPath();
  target.moveTo(item.points[0].x, item.points[0].y);
  for (let index = 1; index < item.points.length - 1; index += 1) {
    const current = item.points[index];
    const next = item.points[index + 1];
    target.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = item.points.at(-1);
  target.lineTo(last.x, last.y);
  target.stroke();
}

function changed() {
  dirty = true;
  updateHistoryButtons();
  requestRender();
  window.clearTimeout(saveTimer);
  saveStatus.className = "note-save-status is-saving";
  saveStatus.textContent = "保存中…";
  saveTimer = window.setTimeout(save, 250);
}

function updateHistoryButtons() {
  undoButton.disabled = !history.canUndo;
  redoButton.disabled = !history.canRedo;
}

function save() {
  window.clearTimeout(saveTimer);
  try {
    if (dirty) store = setNoteDrawing(store, history.current, pageId);
    store = setActiveNotePage(store, pageId);
    replaceStoredNoteStore(localStorage, NOTE_STORAGE_KEY, store);
    dirty = false;
    saveStatus.className = "note-save-status";
    saveStatus.textContent = "保存済み";
    return true;
  } catch { showError("自由ノートを保存できませんでした"); return false; }
}

function persist() {
  try {
    replaceStoredNoteStore(localStorage, NOTE_STORAGE_KEY, store);
    saveStatus.className = "note-save-status";
    saveStatus.textContent = "保存済み";
    return true;
  } catch { showError("自由ノートを保存できませんでした"); return false; }
}

function showError(message) {
  saveStatus.className = "note-save-status is-error";
  saveStatus.textContent = message;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新日時不明";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

showGallery();
updateHistoryButtons();
requestRender();
