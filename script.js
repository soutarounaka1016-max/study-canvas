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
} from "./src/drawing-model.js?v=20260720-1";
import {
  emptyPageStore,
  getPageDrawing,
  listWrittenPageDates,
  loadPageStore,
  serializePageStore,
  setPageDrawing,
  shiftDate,
} from "./src/page-store.js?v=20260720-1";
import {
  createBackupFilename,
  getBackupSummary,
  parseBackup,
  serializeBackup,
} from "./src/backup.js?v=20260720-1";
import {
  addTask,
  deleteTask,
  emptyTaskStore,
  getTasksForDate,
  parseTaskStore,
  serializeTaskStore,
  updateTask,
} from "./src/task-store.js?v=20260720-1";
import {
  createNote,
  emptyNoteStore,
  getNote,
  listNotes,
  parseNoteStore,
  serializeNoteStore,
  setNoteDrawing,
} from "./src/note-store.js?v=20260720-1";

const LEGACY_STORAGE_KEY = "study-canvas:drawing:v1";
const DAILY_STORE_KEY = "study-canvas:pages:v2";
const TASK_STORE_KEY = "study-canvas:tasks:v1";
const WEEKLY_STORE_KEY = "study-canvas:weekly:v1";
const NOTE_STORE_KEY = "study-canvas:notes:v1";
const RESTORE_SAFETY_KEY = "study-canvas:restore-safety:v1";

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
const backupButton = document.querySelector("#backupButton");
const backupStatus = document.querySelector("#backupStatus");
const restoreButton = document.querySelector("#restoreButton");
const restorePreviousButton = document.querySelector("#restorePreviousButton");
const restoreFileInput = document.querySelector("#restoreFileInput");
const restoreDialog = document.querySelector("#restoreDialog");
const restoreSummary = document.querySelector("#restoreSummary");
const cancelRestoreButton = document.querySelector("#cancelRestoreButton");
const confirmRestoreButton = document.querySelector("#confirmRestoreButton");
const dailyModeButton = document.querySelector("#dailyModeButton");
const weeklyModeButton = document.querySelector("#weeklyModeButton");
const freeNoteButton = document.querySelector("#freeNoteButton");
const newTaskButton = document.querySelector("#newTaskButton");
const taskLayer = document.querySelector("#taskLayer");
const taskDialog = document.querySelector("#taskDialog");
const taskForm = document.querySelector("#taskForm");
const taskSubject = document.querySelector("#taskSubject");
const taskTitle = document.querySelector("#taskTitle");
const taskMinutes = document.querySelector("#taskMinutes");
const cancelTaskButton = document.querySelector("#cancelTaskButton");
const noteListDialog = document.querySelector("#noteListDialog");
const closeNoteListButton = document.querySelector("#closeNoteListButton");
const newNoteForm = document.querySelector("#newNoteForm");
const newNoteTitle = document.querySelector("#newNoteTitle");
const noteList = document.querySelector("#noteList");
const emptyNoteList = document.querySelector("#emptyNoteList");
const clearButton = document.querySelector("#clearButton");
const clearDialog = document.querySelector("#clearDialog");
const confirmClearButton = document.querySelector("#confirmClearButton");

const today = formatDateKey(new Date());
const currentWeek = getWeekStart(today);

let dailyPages;
let weeklyPages;
let tasks;
let notes;
try {
  const loaded = loadPageStore(
    localStorage.getItem(DAILY_STORE_KEY),
    localStorage.getItem(LEGACY_STORAGE_KEY),
    today,
  );
  dailyPages = loaded.store;
  weeklyPages = loadPageStore(localStorage.getItem(WEEKLY_STORE_KEY), null, currentWeek).store;
  tasks = parseTaskStore(localStorage.getItem(TASK_STORE_KEY)) || emptyTaskStore();
  notes = parseNoteStore(localStorage.getItem(NOTE_STORE_KEY)) || emptyNoteStore();
  if (loaded.migrated) localStorage.setItem(DAILY_STORE_KEY, serializePageStore(dailyPages));
  if (loaded.recovered) showSaveError("旧データから復旧しました");
} catch {
  dailyPages = emptyPageStore();
  weeklyPages = emptyPageStore();
  tasks = emptyTaskStore();
  notes = emptyNoteStore();
  showSaveError("保存データを読み込めませんでした");
}

let activeMode = "daily";
let activeDate = today;
let lastDailyDate = today;
let lastWeeklyDate = currentWeek;
let activeNoteId = null;
let pendingRestore = null;
let history = new DrawingHistory(getPageDrawing(dailyPages, activeDate));
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

previousDateButton.addEventListener("click", () => shiftActivePage(-1));
nextDateButton.addEventListener("click", () => shiftActivePage(1));
todayButton.addEventListener("click", () => switchDate(activeMode === "weekly" ? currentWeek : today));
dailyModeButton.addEventListener("click", openDailyCanvas);
weeklyModeButton.addEventListener("click", openWeeklyCanvas);
freeNoteButton.addEventListener("click", openNoteList);
pageListButton.addEventListener("click", openPageList);
closePageListButton.addEventListener("click", () => pageListDialog.close());
closeNoteListButton.addEventListener("click", () => noteListDialog.close());
undoButton.addEventListener("click", () => { history.undo(); clearSelection(); afterDocumentChange(); });
redoButton.addEventListener("click", () => { history.redo(); clearSelection(); afterDocumentChange(); });
selectionDeleteButton.addEventListener("click", deleteSelection);
newTaskButton.addEventListener("click", openTaskDialog);
cancelTaskButton.addEventListener("click", () => taskDialog.close());
taskForm.addEventListener("submit", addTaskFromForm);
newNoteForm.addEventListener("submit", addNoteFromForm);
backupButton.addEventListener("click", downloadBackup);
restoreButton.addEventListener("click", () => {
  if (!saveImmediately()) return;
  restoreFileInput.value = "";
  restoreFileInput.click();
});
restoreFileInput.addEventListener("change", loadRestoreFile);
restorePreviousButton.addEventListener("click", loadSafetyRestore);
cancelRestoreButton.addEventListener("click", () => { pendingRestore = null; restoreDialog.close(); });
confirmRestoreButton.addEventListener("click", applyPendingRestore);

clearButton.addEventListener("click", () => {
  document.querySelector(".menu").removeAttribute("open");
  clearDialog.showModal();
});
confirmClearButton.addEventListener("click", () => {
  if (history.current.strokes.length === 0) return;
  history.commit(emptyDrawing(activeMode === "note" ? "" : activeDate));
  clearSelection();
  afterDocumentChange();
});

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", finishPointer);
canvas.addEventListener("pointercancel", finishPointer);
canvas.addEventListener("lostpointercapture", finishPointer);
document.addEventListener("dblclick", (event) => event.preventDefault(), { passive: false });
document.addEventListener("selectstart", (event) => {
  if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
});
document.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("pagehide", saveImmediately);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveImmediately();
});

function formatDateKey(date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function getWeekStart(date) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  const offset = (value.getUTCDay() + 6) % 7;
  return shiftDate(date, -offset);
}

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

function openDailyCanvas() {
  if (!setMode("daily")) return;
  activeDate = lastDailyDate;
  resetHistory();
}

function openWeeklyCanvas() {
  if (!setMode("weekly")) return;
  activeDate = lastWeeklyDate;
  resetHistory();
}

function setMode(mode) {
  document.querySelector(".menu").removeAttribute("open");
  if (mode === activeMode) return false;
  if (!saveImmediately()) return false;
  clearSelection();
  if (activeMode === "daily") lastDailyDate = activeDate;
  if (activeMode === "weekly") lastWeeklyDate = activeDate;
  activeMode = mode;
  activeNoteId = mode === "note" ? activeNoteId : null;
  return true;
}

function shiftActivePage(amount) {
  if (activeMode === "note") return;
  switchDate(shiftDate(activeDate, activeMode === "weekly" ? amount * 7 : amount));
}

function switchDate(nextDate) {
  if (nextDate === activeDate || activePointerId !== null) return;
  if (!saveImmediately()) return;
  clearSelection();
  activeDate = nextDate;
  if (activeMode === "daily") lastDailyDate = activeDate;
  if (activeMode === "weekly") lastWeeklyDate = activeDate;
  resetHistory();
}

function resetHistory() {
  history = new DrawingHistory(getActiveDrawing());
  updateModeDisplay();
  updateHistoryButtons();
  renderTaskCards();
  requestRender();
}

function getActiveDrawing() {
  if (activeMode === "weekly") return getPageDrawing(weeklyPages, activeDate);
  if (activeMode === "note") return getNote(notes, activeNoteId)?.drawing || emptyDrawing("");
  return getPageDrawing(dailyPages, activeDate);
}

function updateModeDisplay() {
  const note = activeMode === "note" ? getNote(notes, activeNoteId) : null;
  if (activeMode === "weekly") {
    documentTitle.textContent = activeDate === currentWeek ? "今週の目標" : "この週の目標";
    pageDate.textContent = formatWeek(activeDate);
    pageDate.dateTime = activeDate;
    emptyHint.textContent = "今週の目標を自由に書いてください";
    canvas.setAttribute("aria-label", "週間目標を書く白いキャンバス");
  } else if (activeMode === "note") {
    documentTitle.textContent = note?.title || "自由ノート";
    pageDate.textContent = "自由ノート";
    pageDate.removeAttribute("datetime");
    emptyHint.textContent = "模試の反省や長期計画を自由に書いてください";
    canvas.setAttribute("aria-label", "自由ノートを書く白いキャンバス");
  } else {
    documentTitle.textContent = activeDate === today ? "今日の計画" : "この日の計画";
    pageDate.textContent = formatDate(activeDate);
    pageDate.dateTime = activeDate;
    emptyHint.textContent = "Apple Pencilまたは指で、今日の計画を書いてください";
    canvas.setAttribute("aria-label", "今日の計画を書く白いキャンバス");
  }
  const noteMode = activeMode === "note";
  previousDateButton.hidden = noteMode;
  nextDateButton.hidden = noteMode;
  todayButton.hidden = noteMode;
  todayButton.disabled = activeMode === "weekly" ? activeDate === currentWeek : activeDate === today;
  pageListButton.hidden = activeMode !== "daily";
  newTaskButton.hidden = activeMode !== "daily";
  taskLayer.hidden = activeMode !== "daily";
  restorePreviousButton.hidden = !localStorage.getItem(RESTORE_SAFETY_KEY);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short",
  }).format(new Date(`${date}T00:00:00+09:00`));
}

function formatWeek(start) {
  const end = shiftDate(start, 6);
  const format = (date) => {
    const [, month, day] = date.split("-").map(Number);
    return `${month}月${day}日`;
  };
  return `${format(start)}〜${format(end)}`;
}

function openPageList() {
  if (activeMode !== "daily" || !saveImmediately()) return;
  renderPageList();
  pageListDialog.showModal();
}

function renderPageList() {
  pageList.replaceChildren();
  const dates = listWrittenPageDates(dailyPages);
  emptyPageList.hidden = dates.length > 0;
  for (const date of dates) {
    const drawing = getPageDrawing(dailyPages, date);
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

function openNoteList() {
  document.querySelector(".menu").removeAttribute("open");
  if (!saveImmediately()) return;
  renderNoteList();
  noteListDialog.showModal();
}

function renderNoteList() {
  noteList.replaceChildren();
  const items = listNotes(notes);
  emptyNoteList.hidden = items.length > 0;
  for (const note of items) {
    const button = document.createElement("button");
    const title = document.createElement("strong");
    const detail = document.createElement("small");
    button.type = "button";
    button.setAttribute("aria-label", `${note.title}を開く`);
    title.textContent = note.title;
    detail.textContent = `${note.drawing.strokes.length}本の手書き`;
    button.append(title, detail);
    button.addEventListener("click", () => openNote(note.id));
    noteList.append(button);
  }
}

function addNoteFromForm(event) {
  event.preventDefault();
  const id = globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random()}`;
  notes = createNote(notes, id, newNoteTitle.value, new Date().toISOString());
  localStorage.setItem(NOTE_STORE_KEY, serializeNoteStore(notes));
  newNoteForm.reset();
  openNote(id);
}

function openNote(id) {
  if (activeMode !== "note" && !setMode("note")) return;
  activeNoteId = id;
  noteListDialog.close();
  resetHistory();
}

function openTaskDialog() {
  if (activeMode !== "daily") return;
  taskForm.reset();
  taskMinutes.value = "60";
  taskDialog.showModal();
  taskTitle.focus();
}

function addTaskFromForm(event) {
  event.preventDefault();
  const existing = getTasksForDate(tasks, activeDate);
  const index = existing.length;
  tasks = addTask(tasks, activeDate, {
    id: globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random()}`,
    subject: taskSubject.value,
    title: taskTitle.value,
    minutes: Number(taskMinutes.value),
    completed: false,
    x: 40 + (index % 3) * 380,
    y: 40 + Math.floor(index / 3) * 150,
  });
  saveTasks();
  taskDialog.close();
  renderTaskCards();
  requestRender();
}

function renderTaskCards() {
  taskLayer.replaceChildren();
  if (activeMode !== "daily") return;
  for (const task of getTasksForDate(tasks, activeDate)) {
    const card = document.createElement("article");
    const handle = document.createElement("button");
    const main = document.createElement("div");
    const subject = document.createElement("span");
    const title = document.createElement("span");
    const time = document.createElement("small");
    const complete = document.createElement("input");
    const remove = document.createElement("button");
    card.className = "task-card";
    card.classList.toggle("is-completed", task.completed);
    card.style.left = `${(task.x / BASE_WIDTH) * 100}%`;
    card.style.top = `${(task.y / BASE_HEIGHT) * 100}%`;
    handle.type = "button";
    handle.className = "task-drag-handle";
    handle.textContent = "⋮⋮";
    handle.setAttribute("aria-label", `${task.title}を移動`);
    main.className = "task-card-main";
    subject.className = "task-card-subject";
    subject.textContent = task.subject || "タスク";
    title.className = "task-card-title";
    title.textContent = task.title;
    main.append(subject, title);
    time.className = "task-card-time";
    time.textContent = `${task.minutes}分`;
    complete.type = "checkbox";
    complete.className = "task-complete";
    complete.checked = task.completed;
    complete.setAttribute("aria-label", `${task.title}を完了にする`);
    complete.addEventListener("change", () => {
      tasks = updateTask(tasks, activeDate, task.id, { completed: complete.checked });
      saveTasks();
      renderTaskCards();
    });
    remove.type = "button";
    remove.className = "task-delete-button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${task.title}を削除`);
    remove.addEventListener("click", () => {
      if (!window.confirm(`「${task.title}」を削除しますか？`)) return;
      tasks = deleteTask(tasks, activeDate, task.id);
      saveTasks();
      renderTaskCards();
      requestRender();
    });
    addTaskDrag(handle, card, task);
    card.append(handle, complete, main, remove, time);
    taskLayer.append(card);
  }
}

function addTaskDrag(handle, card, task) {
  let drag = null;
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: task.x, y: task.y };
  });
  handle.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const rect = page.getBoundingClientRect();
    task.x = Math.max(0, Math.min(1200, drag.x + ((event.clientX - drag.startX) / rect.width) * BASE_WIDTH));
    task.y = Math.max(0, Math.min(840, drag.y + ((event.clientY - drag.startY) / rect.height) * BASE_HEIGHT));
    card.style.left = `${(task.x / BASE_WIDTH) * 100}%`;
    card.style.top = `${(task.y / BASE_HEIGHT) * 100}%`;
  });
  const finish = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    tasks = updateTask(tasks, activeDate, task.id, { x: task.x, y: task.y });
    saveTasks();
    drag = null;
  };
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
}

function saveTasks() {
  try {
    localStorage.setItem(TASK_STORE_KEY, serializeTaskStore(tasks));
    saveState.className = "save-state";
    saveStatus.textContent = "保存済み";
  } catch {
    showSaveError("タスクを保存できませんでした");
  }
}

function getAllData() {
  return { dailyPages, tasks, weeklyPages, notes };
}

function downloadBackup() {
  if (!saveImmediately()) return;
  try {
    const content = serializeBackup(getAllData(), new Date());
    const blobUrl = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = createBackupFilename(formatDateKey(new Date()));
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    const summary = getBackupSummary(getAllData());
    const pageCount = summary.dailyPageCount + summary.weeklyPageCount + summary.noteCount;
    backupStatus.textContent = `計画${pageCount}ページ・タスク${summary.taskCount}件を保存しました`;
    backupStatus.hidden = false;
  } catch {
    backupStatus.textContent = "バックアップを保存できませんでした";
    backupStatus.hidden = false;
  }
}

async function loadRestoreFile() {
  const [file] = restoreFileInput.files || [];
  if (!file) return;
  try {
    const parsed = parseBackup(await file.text());
    if (!parsed) throw new Error("invalid backup");
    queueRestore(parsed, file.name);
  } catch {
    backupStatus.textContent = "このファイルはStudy Canvasのバックアップではありません";
    backupStatus.hidden = false;
  }
}

function loadSafetyRestore() {
  document.querySelector(".menu").removeAttribute("open");
  const parsed = parseBackup(localStorage.getItem(RESTORE_SAFETY_KEY));
  if (!parsed) {
    backupStatus.textContent = "復元前の安全コピーを読み込めませんでした";
    backupStatus.hidden = false;
    return;
  }
  queueRestore(parsed, "復元前の安全コピー");
}

function queueRestore(parsed, sourceName) {
  document.querySelector(".menu").removeAttribute("open");
  pendingRestore = parsed;
  const data = {
    dailyPages: parsed.data.dailyPages,
    tasks: parsed.data.tasks || tasks,
    weeklyPages: parsed.data.weeklyPages || weeklyPages,
    notes: parsed.data.notes || notes,
  };
  const summary = getBackupSummary(data);
  const oldBackupNote = parsed.version === 1 ? "（旧形式のため、タスク・週間目標・自由ノートは現在のまま残します）" : "";
  restoreSummary.textContent = `${sourceName}：日別${summary.dailyPageCount}ページ、タスク${summary.taskCount}件、週間${summary.weeklyPageCount}ページ、自由ノート${summary.noteCount}冊を復元します。${oldBackupNote}`;
  restoreDialog.showModal();
}

function applyPendingRestore() {
  if (!pendingRestore) return;
  try {
    localStorage.setItem(RESTORE_SAFETY_KEY, serializeBackup(getAllData(), new Date()));
    dailyPages = pendingRestore.data.dailyPages;
    if (pendingRestore.data.tasks) tasks = pendingRestore.data.tasks;
    if (pendingRestore.data.weeklyPages) weeklyPages = pendingRestore.data.weeklyPages;
    if (pendingRestore.data.notes) notes = pendingRestore.data.notes;
    persistAllStores();
    pendingRestore = null;
    activeMode = "daily";
    activeDate = today;
    lastDailyDate = today;
    activeNoteId = null;
    clearSelection();
    restoreDialog.close();
    backupStatus.textContent = "バックアップを復元しました";
    backupStatus.hidden = false;
    resetHistory();
  } catch {
    showSaveError("バックアップを復元できませんでした");
  }
}

function persistAllStores() {
  localStorage.setItem(DAILY_STORE_KEY, serializePageStore(dailyPages));
  localStorage.setItem(TASK_STORE_KEY, serializeTaskStore(tasks));
  localStorage.setItem(WEEKLY_STORE_KEY, serializePageStore(weeklyPages));
  localStorage.setItem(NOTE_STORE_KEY, serializeNoteStore(notes));
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
      selectionResize = { ...resizeHandle, start: point, drawing: cloneDrawing(history.current), moved: false };
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
      const scale = handleLengthSquared > 0 ? 1 + (movedX * handleX + movedY * handleY) / handleLengthSquared : 1;
      selectionResize.moved ||= Math.hypot(movedX, movedY) >= 0.8;
      selectionDraft = scaleSelectedStrokes(selectionResize.drawing, selectedStrokeIds, selectionResize.anchor, scale);
    } else if (selectionDrag) {
      const dx = point.x - selectionDrag.start.x;
      const dy = point.y - selectionDrag.start.y;
      selectionDrag.moved ||= Math.hypot(dx, dy) >= 0.8;
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
  eraseDraft.strokes = eraseDraft.strokes.filter((stroke) => !strokeTouchesPoint(stroke, point, 18));
}

function deleteSelection() {
  if (selectedStrokeIds.size === 0) return;
  history.commit(deleteSelectedStrokes(history.current, selectedStrokeIds));
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
    { handle: { x: minimumX, y: minimumY }, anchor: { x: bounds.maxX, y: bounds.maxY } },
    { handle: { x: maximumX, y: minimumY }, anchor: { x: bounds.minX, y: bounds.maxY } },
    { handle: { x: maximumX, y: maximumY }, anchor: { x: bounds.minX, y: bounds.minY } },
    { handle: { x: minimumX, y: maximumY }, anchor: { x: bounds.maxX, y: bounds.minY } },
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
  const hasTasks = activeMode === "daily" && getTasksForDate(tasks, activeDate).length > 0;
  emptyHint.hidden = drawing.strokes.length > 0 || Boolean(activeStroke) || hasTasks;
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
    context.fillRect(bounds.minX - padding, bounds.minY - padding,
      bounds.maxX - bounds.minX + padding * 2, bounds.maxY - bounds.minY + padding * 2);
    context.strokeRect(bounds.minX - padding, bounds.minY - padding,
      bounds.maxX - bounds.minX + padding * 2, bounds.maxY - bounds.minY + padding * 2);
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
    if (activeMode === "weekly") {
      weeklyPages = setPageDrawing(weeklyPages, activeDate, history.current);
      localStorage.setItem(WEEKLY_STORE_KEY, serializePageStore(weeklyPages));
    } else if (activeMode === "note" && activeNoteId) {
      notes = setNoteDrawing(notes, activeNoteId, history.current);
      localStorage.setItem(NOTE_STORE_KEY, serializeNoteStore(notes));
    } else {
      dailyPages = setPageDrawing(dailyPages, activeDate, history.current);
      localStorage.setItem(DAILY_STORE_KEY, serializePageStore(dailyPages));
    }
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
  selectionHint.textContent = selectedStrokeIds.size > 0
    ? `${selectedStrokeIds.size}本を選択中。枠内で移動、四隅の丸で拡大・縮小できます`
    : "手書きを囲んで選択してください";
}

updateModeDisplay();
updateHistoryButtons();
renderTaskCards();
requestRender();
