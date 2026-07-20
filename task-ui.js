import {
  TASK_STORAGE_KEY,
  addTask,
  deleteTask,
  getTasksForDate,
  loadTaskStore,
  replaceStoredTaskStore,
  toggleTask,
  updateTask,
  updateTaskPosition,
  validateTaskInput,
} from "./src/task-store.js?v=20260720-7";

const pageDate = document.querySelector("#pageDate");
const taskButton = document.querySelector("#taskButton");
const taskCountBadge = document.querySelector("#taskCountBadge");
const taskDialog = document.querySelector("#taskDialog");
const closeTaskDialogButton = document.querySelector("#closeTaskDialogButton");
const taskDialogDate = document.querySelector("#taskDialogDate");
const taskForm = document.querySelector("#taskForm");
const taskSubject = document.querySelector("#taskSubject");
const taskTitle = document.querySelector("#taskTitle");
const taskMinutes = document.querySelector("#taskMinutes");
const saveTaskButton = document.querySelector("#saveTaskButton");
const cancelTaskEditButton = document.querySelector("#cancelTaskEditButton");
const taskFormError = document.querySelector("#taskFormError");
const taskProgress = document.querySelector("#taskProgress");
const taskStorageStatus = document.querySelector("#taskStorageStatus");
const emptyTaskList = document.querySelector("#emptyTaskList");
const taskList = document.querySelector("#taskList");
const dailyCanvasStage = document.querySelector("#dailyCanvasStage");

const taskBoard = document.createElement("section");
taskBoard.id = "taskBoard";
taskBoard.className = "canvas-task-board";
taskBoard.setAttribute("aria-label", "キャンバス上のタスクカード");
const boardAddButton = document.createElement("button");
boardAddButton.type = "button";
boardAddButton.className = "canvas-task-add-button";
boardAddButton.textContent = "＋ タスク";
boardAddButton.setAttribute("aria-label", "この日にタスクを追加");
taskBoard.append(boardAddButton);
dailyCanvasStage.append(taskBoard);

let activeDate = pageDate.dateTime;
let editingTaskId = null;
let dragState = null;
const loaded = loadTaskStore(localStorage.getItem(TASK_STORAGE_KEY));
let taskStore = loaded.store;

if (loaded.recovered) showStorageStatus("壊れたタスクデータを除いて読み込みました", true);

new MutationObserver(() => {
  const nextDate = pageDate.dateTime;
  if (!nextDate || nextDate === activeDate) return;
  activeDate = nextDate;
  resetForm();
  renderTasks();
}).observe(pageDate, { attributes: true, attributeFilter: ["datetime"] });

taskButton.addEventListener("click", openTaskDialog);
boardAddButton.addEventListener("click", (event) => {
  event.stopPropagation();
  resetForm();
  openTaskDialog();
  requestAnimationFrame(() => taskSubject.focus());
});
closeTaskDialogButton.addEventListener("click", () => taskDialog.close());
taskDialog.addEventListener("close", resetForm);

for (const eventName of ["selectstart", "contextmenu", "dblclick"]) {
  taskDialog.addEventListener(eventName, (event) => event.stopPropagation());
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  hideFormError();

  try {
    const input = validateTaskInput({
      subject: taskSubject.value,
      title: taskTitle.value,
      plannedMinutes: taskMinutes.value,
    });
    const nextStore = editingTaskId
      ? updateTask(taskStore, activeDate, editingTaskId, input)
      : addTask(taskStore, activeDate, input, createTaskId());
    if (persistTasks(nextStore, editingTaskId ? "タスクを更新しました" : "タスクを追加しました")) {
      resetForm();
      taskDialog.close();
    }
  } catch (error) {
    showFormError(error.message);
  }
});

cancelTaskEditButton.addEventListener("click", resetForm);
window.addEventListener("pointermove", handleCardDrag, { passive: false });
window.addEventListener("pointerup", finishCardDrag);
window.addEventListener("pointercancel", finishCardDrag);

function openTaskDialog() {
  activeDate = pageDate.dateTime;
  renderTasks();
  taskDialog.showModal();
}

function renderTasks() {
  if (!activeDate) return;
  const tasks = getTasksForDate(taskStore, activeDate);
  const completedCount = tasks.filter((task) => task.completed).length;
  const remainingCount = tasks.length - completedCount;
  const plannedMinutes = tasks.reduce((sum, task) => sum + task.plannedMinutes, 0);

  taskDialogDate.dateTime = activeDate;
  taskDialogDate.textContent = formatDate(activeDate);
  taskProgress.textContent = tasks.length > 0
    ? `${completedCount}/${tasks.length}件完了・予定${plannedMinutes}分`
    : "タスクはまだありません";
  taskCountBadge.textContent = String(remainingCount);
  taskCountBadge.hidden = remainingCount === 0;
  emptyTaskList.hidden = tasks.length > 0;
  taskList.replaceChildren();

  taskBoard.querySelectorAll(".canvas-task-card").forEach((card) => card.remove());
  for (const task of tasks) {
    taskList.append(createDialogTaskCard(task));
    taskBoard.append(createCanvasTaskCard(task));
  }
  taskBoard.classList.toggle("has-tasks", tasks.length > 0);
}

function createDialogTaskCard(task) {
  const card = document.createElement("article");
  const completionLabel = document.createElement("label");
  const checkbox = document.createElement("input");
  const body = document.createElement("div");
  const heading = document.createElement("div");
  const subject = document.createElement("span");
  const title = document.createElement("strong");
  const minutes = document.createElement("small");
  const actions = document.createElement("div");
  const editButton = document.createElement("button");
  const deleteButton = document.createElement("button");

  card.className = "task-card";
  card.classList.toggle("is-completed", task.completed);
  completionLabel.className = "task-completion";
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `${task.title}を${task.completed ? "未完了" : "完了"}にする`);
  body.className = "task-card-body";
  heading.className = "task-card-heading";
  subject.className = "task-subject";
  subject.dataset.subject = task.subject;
  subject.textContent = task.subject;
  title.textContent = task.title;
  minutes.textContent = `予定 ${task.plannedMinutes}分`;
  actions.className = "task-card-actions";
  editButton.type = "button";
  editButton.textContent = "編集";
  deleteButton.type = "button";
  deleteButton.className = "task-delete-button";
  deleteButton.textContent = "削除";

  checkbox.addEventListener("change", () => toggleTaskCompletion(task));
  editButton.addEventListener("click", () => beginEdit(task));
  deleteButton.addEventListener("click", () => removeTask(task));

  completionLabel.append(checkbox);
  heading.append(subject, title);
  actions.append(editButton, deleteButton);
  body.append(heading, minutes, actions);
  card.append(completionLabel, body);
  return card;
}

function createCanvasTaskCard(task) {
  const card = document.createElement("article");
  const dragHandle = document.createElement("button");
  const checkbox = document.createElement("input");
  const content = document.createElement("button");
  const subject = document.createElement("span");
  const title = document.createElement("strong");
  const minutes = document.createElement("small");

  card.className = "canvas-task-card";
  card.classList.toggle("is-completed", task.completed);
  card.style.left = `${task.x * 100}%`;
  card.style.top = `${task.y * 100}%`;
  card.dataset.taskId = task.id;

  dragHandle.type = "button";
  dragHandle.className = "canvas-task-drag-handle";
  dragHandle.textContent = "⠿";
  dragHandle.setAttribute("aria-label", `${task.title}を移動`);
  checkbox.type = "checkbox";
  checkbox.className = "canvas-task-checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `${task.title}を${task.completed ? "未完了" : "完了"}にする`);
  content.type = "button";
  content.className = "canvas-task-content";
  content.setAttribute("aria-label", `${task.title}を編集`);
  subject.className = "canvas-task-subject";
  subject.dataset.subject = task.subject;
  subject.textContent = task.subject;
  title.textContent = task.title;
  minutes.textContent = `${task.plannedMinutes}分`;

  dragHandle.addEventListener("pointerdown", (event) => startCardDrag(event, task, card));
  checkbox.addEventListener("change", (event) => {
    event.stopPropagation();
    toggleTaskCompletion(task);
  });
  content.addEventListener("click", (event) => {
    event.stopPropagation();
    beginEdit(task);
    openTaskDialog();
  });
  for (const element of [card, dragHandle, checkbox, content]) {
    element.addEventListener("pointerdown", (event) => event.stopPropagation());
    element.addEventListener("dblclick", (event) => event.stopPropagation());
    element.addEventListener("contextmenu", (event) => event.stopPropagation());
  }

  content.append(subject, title, minutes);
  card.append(dragHandle, checkbox, content);
  return card;
}

function startCardDrag(event, task, card) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const rect = dailyCanvasStage.getBoundingClientRect();
  dragState = {
    pointerId: event.pointerId,
    task,
    card,
    rect,
    offsetX: event.clientX - card.getBoundingClientRect().left,
    offsetY: event.clientY - card.getBoundingClientRect().top,
  };
  card.classList.add("is-dragging");
  document.body.classList.add("is-dragging-task-card");
}

function handleCardDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  event.preventDefault();
  const { rect, card, offsetX, offsetY } = dragState;
  const width = card.offsetWidth / rect.width;
  const height = card.offsetHeight / rect.height;
  const x = clamp((event.clientX - rect.left - offsetX) / rect.width, 0, 1 - width);
  const y = clamp((event.clientY - rect.top - offsetY) / rect.height, 0, 1 - height);
  card.style.left = `${x * 100}%`;
  card.style.top = `${y * 100}%`;
  dragState.position = { x, y };
}

function finishCardDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const { task, card, position } = dragState;
  card.classList.remove("is-dragging");
  document.body.classList.remove("is-dragging-task-card");
  dragState = null;
  if (!position) return;
  try {
    persistTasks(updateTaskPosition(taskStore, activeDate, task.id, position), "カードの位置を保存しました", false);
  } catch (error) {
    showStorageStatus(error.message, true);
    renderTasks();
  }
}

function toggleTaskCompletion(task) {
  try {
    persistTasks(toggleTask(taskStore, activeDate, task.id), task.completed ? "未完了に戻しました" : "完了にしました");
  } catch (error) {
    showStorageStatus(error.message, true);
    renderTasks();
  }
}

function removeTask(task) {
  if (!window.confirm(`「${task.title}」を削除しますか？`)) return;
  try {
    const nextStore = deleteTask(taskStore, activeDate, task.id);
    if (persistTasks(nextStore, "タスクを削除しました") && editingTaskId === task.id) resetForm();
  } catch (error) {
    showStorageStatus(error.message, true);
  }
}

function beginEdit(task) {
  editingTaskId = task.id;
  taskSubject.value = task.subject;
  taskTitle.value = task.title;
  taskMinutes.value = String(task.plannedMinutes);
  saveTaskButton.textContent = "変更を保存";
  cancelTaskEditButton.hidden = false;
  hideFormError();
  requestAnimationFrame(() => taskTitle.focus());
}

function resetForm() {
  editingTaskId = null;
  taskForm.reset();
  taskMinutes.value = "30";
  saveTaskButton.textContent = "タスクを追加";
  cancelTaskEditButton.hidden = true;
  hideFormError();
}

function persistTasks(nextStore, message, announce = true) {
  try {
    replaceStoredTaskStore(localStorage, TASK_STORAGE_KEY, nextStore);
    taskStore = nextStore;
    if (announce) showStorageStatus(message, false);
    renderTasks();
    return true;
  } catch {
    showStorageStatus("タスクを保存できませんでした。変更前の状態を維持しています", true);
    renderTasks();
    return false;
  }
}

function showFormError(message) {
  taskFormError.textContent = message;
  taskFormError.hidden = false;
}

function hideFormError() {
  taskFormError.hidden = true;
  taskFormError.textContent = "";
}

function showStorageStatus(message, isError) {
  taskStorageStatus.textContent = message;
  taskStorageStatus.classList.toggle("is-error", isError);
  taskStorageStatus.hidden = false;
}

function createTaskId() {
  return globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

renderTasks();
