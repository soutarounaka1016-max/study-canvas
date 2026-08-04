import { CanvasViewport } from "./src/canvas-viewport.js?v=20260804-1";
import { TASK_STORAGE_KEY, getTasksForDate, loadTaskStore, replaceStoredTaskStore, toggleTask } from "./src/task-store.js?v=20260729-1";
import {
  SCHEDULE_STORAGE_KEY, addSchedulePlacement, getScheduleDay, getSchedulePlacementInstances,
  loadScheduleStore, removeSchedulePlacementInstance, replaceStoredScheduleStore,
  setScheduleDrawing, updateSchedulePlacement,
} from "./src/schedule-store.js?v=20260804-2";

const pageDate = document.querySelector("#pageDate");
const planWorkspace = document.querySelector(".workspace");
const scheduleWorkspace = document.querySelector("#scheduleWorkspace");
const wrap = document.querySelector("#scheduleCanvasWrap");
const stage = document.querySelector("#scheduleCanvasStage");
const canvas = document.querySelector("#scheduleCanvas");
const taskBoard = document.querySelector("#scheduleTaskBoard");
const unplacedList = document.querySelector("#scheduleUnplacedTasks");
const status = document.querySelector("#scheduleStatus");
const documentTitle = document.querySelector("#documentTitle");
const tabs = document.querySelector("#dailyViewTabs");
const context = canvas.getContext("2d");
const viewport = new CanvasViewport(wrap, stage, { onGestureStart: cancelDrawing });

let activeDate = pageDate.dateTime;
let scheduleStore = loadScheduleStore(localStorage.getItem(SCHEDULE_STORAGE_KEY)).store;
let drawing = getScheduleDay(scheduleStore, activeDate).drawing;
let activeStroke = null;
let activePointerId = null;
let cardDrag = null;
let renderQueued = false;

new ResizeObserver(resizeCanvas).observe(wrap);
tabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-daily-view]");
  if (button) switchView(button.dataset.dailyView);
});
pageDate.addEventListener("datechange", loadDate);
new MutationObserver(loadDate).observe(pageDate, { attributes: true, attributeFilter: ["datetime"] });
canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
canvas.addEventListener("pointerup", pointerEnd);
canvas.addEventListener("pointercancel", pointerEnd);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
taskBoard.addEventListener("pointerdown", startCardDrag);
window.addEventListener("pointermove", moveCard, { passive: false });
window.addEventListener("pointerup", finishCard);
window.addEventListener("pointercancel", finishCard);
unplacedList.addEventListener("click", placeUnscheduledTask);
document.querySelector("#scheduleUndoButton").addEventListener("click", undoLastStroke);
document.querySelector("#scheduleClearButton").addEventListener("click", clearDrawing);
document.addEventListener("study-canvas:tasks-changed", renderTasks);
document.addEventListener("study-canvas:schedule-placement-request", placeRequestedTask);
window.addEventListener("storage", (event) => {
  if (event.key === SCHEDULE_STORAGE_KEY) loadDate();
  if (event.key === TASK_STORAGE_KEY) renderTasks();
});

function switchView(view) {
  const schedule = view === "schedule";
  document.body.dataset.dailyView = schedule ? "schedule" : "plan";
  planWorkspace.hidden = schedule;
  scheduleWorkspace.hidden = !schedule;
  documentTitle.textContent = schedule ? "今日のスケジュール" : "今日の計画";
  for (const button of tabs.querySelectorAll("[data-daily-view]")) {
    const selected = button.dataset.dailyView === (schedule ? "schedule" : "plan");
    button.setAttribute("aria-selected", String(selected));
    button.classList.toggle("is-selected", selected);
  }
  document.dispatchEvent(new CustomEvent("study-canvas:daily-view-changed", { detail: { view: schedule ? "schedule" : "plan" } }));
  if (schedule) { viewport.reset(); resizeCanvas(); renderTasks(); }
}

function loadDate() {
  const nextDate = pageDate.dateTime;
  if (!nextDate) return;
  activeDate = nextDate;
  scheduleStore = loadScheduleStore(localStorage.getItem(SCHEDULE_STORAGE_KEY)).store;
  drawing = getScheduleDay(scheduleStore, activeDate).drawing;
  viewport.reset();
  renderTasks(); requestRender();
}

function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  const scale = Number(stage.dataset.viewScale || 1);
  const cssWidth = Math.max(1, rect.width / scale);
  const cssHeight = Math.max(1, rect.height / scale);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);
  requestRender();
}

function pointerDown(event) {
  if (viewport.pointerDown(event)) return;
  if ((event.pointerType === "mouse" && event.button !== 0) || activePointerId !== null) return;
  const tool = document.querySelector(".tool-button.is-active")?.dataset.tool;
  if (!['pen', 'eraser'].includes(tool)) return;
  event.preventDefault(); activePointerId = event.pointerId; canvas.setPointerCapture(event.pointerId);
  const point = getPoint(event);
  if (tool === "eraser") { eraseAt(point); return; }
  activeStroke = {
    id: globalThis.crypto?.randomUUID?.() || `schedule-stroke-${Date.now()}`,
    color: document.querySelector(".color-button.is-selected")?.dataset.color || "#2558e6",
    width: Number(document.querySelector("#penWidth")?.value || 5), points: [point],
  };
  drawing = { ...drawing, strokes: [...drawing.strokes, activeStroke] }; requestRender();
}

function pointerMove(event) {
  if (viewport.pointerMove(event)) return;
  if (event.pointerId !== activePointerId) return;
  event.preventDefault(); const point = getPoint(event);
  if (activeStroke) { activeStroke.points.push(point); requestRender(); }
  else eraseAt(point);
}

function pointerEnd(event) {
  if (viewport.pointerEnd(event)) return;
  if (event.pointerId !== activePointerId) return;
  activePointerId = null; activeStroke = null; persistDrawing();
}

function cancelDrawing() {
  if (activeStroke) drawing.strokes = drawing.strokes.filter((stroke) => stroke.id !== activeStroke.id);
  activeStroke = null; activePointerId = null; requestRender();
}

function eraseAt(point) {
  const before = drawing.strokes.length;
  drawing = { ...drawing, strokes: drawing.strokes.filter((stroke) => !stroke.points.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < 0.025)) };
  if (drawing.strokes.length !== before) requestRender();
}

function persistDrawing() {
  try {
    scheduleStore = setScheduleDrawing(scheduleStore, activeDate, drawing);
    replaceStoredScheduleStore(localStorage, scheduleStore); setStatus("スケジュールを保存しました");
  } catch { setStatus("スケジュールを保存できませんでした", true); loadDate(); }
}

function renderTasks() {
  const tasks = getTasksForDate(loadTaskStore(localStorage.getItem(TASK_STORAGE_KEY)).store, activeDate);
  const placements = getSchedulePlacementInstances(scheduleStore, activeDate);
  const taskIds = new Set(tasks.map((task) => task.id));
  let changed = false;
  for (const placement of placements) {
    if (!taskIds.has(placement.taskId)) {
      scheduleStore = removeSchedulePlacementInstance(scheduleStore, activeDate, placement.placementId, placement.taskId);
      changed = true;
    }
  }
  if (changed) replaceStoredScheduleStore(localStorage, scheduleStore);
  taskBoard.replaceChildren(); unplacedList.replaceChildren();
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  for (const placement of getSchedulePlacementInstances(scheduleStore, activeDate)) {
    const task = taskById.get(placement.taskId);
    if (task) taskBoard.append(createScheduleCard(task, placement));
  }
  for (const task of tasks) {
    unplacedList.append(createUnplacedCard(task));
  }
  document.querySelector("#scheduleUnplacedEmpty").hidden = tasks.length > 0;
}

function createScheduleCard(task, placement) {
  const card = document.createElement("article");
  card.className = "schedule-task-card"; card.dataset.taskId = task.id; card.dataset.placementId = placement.placementId; card.dataset.subject = task.subject;
  card.classList.toggle("is-completed", task.completed); card.style.left = `${placement.x * 100}%`; card.style.top = `${placement.y * 100}%`;
  card.innerHTML = `<button class="schedule-card-handle" type="button" aria-label="${escapeHtml(task.title)}を移動">⠿</button><label><input type="checkbox" ${task.completed ? "checked" : ""} aria-label="完了"/><span>${escapeHtml(task.title)}</span></label><button class="schedule-card-remove" type="button" aria-label="予定表から外す">×</button>`;
  card.querySelector("input").addEventListener("change", () => toggleCompletion(task.id));
  card.querySelector(".schedule-card-remove").addEventListener("click", () => removePlacement(placement.placementId, task.id));
  return card;
}

function createUnplacedCard(task) {
  const card = document.createElement("article"); card.className = "schedule-unplaced-card"; card.dataset.subject = task.subject;
  card.innerHTML = `<span>${escapeHtml(task.subject)}</span><strong>${escapeHtml(task.title)}</strong><button type="button" data-place-task="${escapeHtml(task.id)}">もう1枚置く</button>`;
  return card;
}

function placeUnscheduledTask(event) {
  const button = event.target.closest("[data-place-task]"); if (!button) return;
  const count = getSchedulePlacementInstances(scheduleStore, activeDate).length;
  savePlacement(button.dataset.placeTask, { x: 0.16 + (count % 2) * 0.4, y: 0.02 + (count % 8) * 0.12 });
}

function placeRequestedTask(event) {
  const { taskId, x, y } = event.detail || {}; if (!taskId) return;
  savePlacement(taskId, { x, y });
}

function savePlacement(taskId, position, placementId = null) {
  try {
    scheduleStore = placementId
      ? updateSchedulePlacement(scheduleStore, activeDate, placementId, taskId, position)
      : addSchedulePlacement(scheduleStore, activeDate, taskId, position, createPlacementId());
    replaceStoredScheduleStore(localStorage, scheduleStore); renderTasks(); setStatus("カード位置を保存しました");
  }
  catch { setStatus("カード位置を保存できませんでした", true); }
}

function removePlacement(placementId, taskId) {
  scheduleStore = removeSchedulePlacementInstance(scheduleStore, activeDate, placementId, taskId); replaceStoredScheduleStore(localStorage, scheduleStore); renderTasks();
}

function startCardDrag(event) {
  const handle = event.target.closest(".schedule-card-handle"); if (!handle) return;
  const card = handle.closest(".schedule-task-card"); event.preventDefault(); event.stopPropagation();
  const rect = stage.getBoundingClientRect();
  cardDrag = { pointerId: event.pointerId, taskId: card.dataset.taskId, placementId: card.dataset.placementId, card, rect, offsetX: event.clientX - card.getBoundingClientRect().left, offsetY: event.clientY - card.getBoundingClientRect().top };
  card.classList.add("is-dragging");
}

function moveCard(event) {
  if (!cardDrag || event.pointerId !== cardDrag.pointerId) return; event.preventDefault();
  const { card, rect, offsetX, offsetY } = cardDrag;
  const x = clamp((event.clientX - rect.left - offsetX) / rect.width, 0, .76);
  const y = clamp((event.clientY - rect.top - offsetY) / rect.height, 0, .925);
  card.style.left = `${x * 100}%`; card.style.top = `${y * 100}%`; cardDrag.position = { x, y };
}

function finishCard(event) {
  if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
  const state = cardDrag; cardDrag = null; state.card.classList.remove("is-dragging");
  if (state.position) savePlacement(state.taskId, state.position, state.placementId);
}

function toggleCompletion(taskId) {
  try {
    const store = loadTaskStore(localStorage.getItem(TASK_STORAGE_KEY)).store;
    replaceStoredTaskStore(localStorage, TASK_STORAGE_KEY, toggleTask(store, activeDate, taskId));
    document.dispatchEvent(new CustomEvent("study-canvas:tasks-changed"));
  } catch { setStatus("完了状態を保存できませんでした", true); renderTasks(); }
}

function undoLastStroke() { if (!drawing.strokes.length) return; drawing = { ...drawing, strokes: drawing.strokes.slice(0, -1) }; persistDrawing(); requestRender(); }
function clearDrawing() { if (!drawing.strokes.length || !window.confirm("スケジュールの手書きを白紙に戻しますか？")) return; drawing = { ...drawing, strokes: [] }; persistDrawing(); requestRender(); }

function requestRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; renderDrawing(); }); }
function renderDrawing() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineCap = "round"; context.lineJoin = "round";
  for (const stroke of drawing.strokes) {
    context.strokeStyle = stroke.color; context.fillStyle = stroke.color; context.lineWidth = stroke.width * (canvas.width / 900);
    const points = stroke.points; context.beginPath();
    context.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
    for (const point of points.slice(1)) context.lineTo(point.x * canvas.width, point.y * canvas.height);
    if (points.length === 1) { context.arc(points[0].x * canvas.width, points[0].y * canvas.height, context.lineWidth / 2, 0, Math.PI * 2); context.fill(); }
    else context.stroke();
  }
}
function getPoint(event) { const rect = canvas.getBoundingClientRect(); return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) }; }
function setStatus(message, error = false) { status.textContent = message; status.classList.toggle("is-error", error); }
function createPlacementId() { return globalThis.crypto?.randomUUID?.() || `schedule-copy-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

switchView("plan");
