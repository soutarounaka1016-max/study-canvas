import {
  TASK_STORAGE_KEY,
  addTask,
  deleteTask,
  getTasksForDate,
  loadTaskStore,
  replaceStoredTaskStore,
  toggleTask,
  updateTask,
  validateTaskInput,
} from "./src/task-store.js?v=20260720-2";

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

let activeDate = pageDate.dateTime;
let editingTaskId = null;
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

taskButton.addEventListener("click", () => {
  activeDate = pageDate.dateTime;
  renderTasks();
  taskDialog.showModal();
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
    }
  } catch (error) {
    showFormError(error.message);
  }
});

cancelTaskEditButton.addEventListener("click", resetForm);

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

  for (const task of tasks) taskList.append(createTaskCard(task));
}

function createTaskCard(task) {
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

  checkbox.addEventListener("change", () => {
    try {
      persistTasks(toggleTask(taskStore, activeDate, task.id), task.completed ? "未完了に戻しました" : "完了にしました");
    } catch (error) {
      showStorageStatus(error.message, true);
      renderTasks();
    }
  });
  editButton.addEventListener("click", () => beginEdit(task));
  deleteButton.addEventListener("click", () => {
    if (!window.confirm(`「${task.title}」を削除しますか？`)) return;
    try {
      const nextStore = deleteTask(taskStore, activeDate, task.id);
      if (persistTasks(nextStore, "タスクを削除しました") && editingTaskId === task.id) resetForm();
    } catch (error) {
      showStorageStatus(error.message, true);
    }
  });

  completionLabel.append(checkbox);
  heading.append(subject, title);
  actions.append(editButton, deleteButton);
  body.append(heading, minutes, actions);
  card.append(completionLabel, body);
  return card;
}

function beginEdit(task) {
  editingTaskId = task.id;
  taskSubject.value = task.subject;
  taskTitle.value = task.title;
  taskMinutes.value = String(task.plannedMinutes);
  saveTaskButton.textContent = "変更を保存";
  cancelTaskEditButton.hidden = false;
  hideFormError();
  taskTitle.focus();
}

function resetForm() {
  editingTaskId = null;
  taskForm.reset();
  taskMinutes.value = "30";
  saveTaskButton.textContent = "タスクを追加";
  cancelTaskEditButton.hidden = true;
  hideFormError();
}

function persistTasks(nextStore, message) {
  try {
    replaceStoredTaskStore(localStorage, TASK_STORAGE_KEY, nextStore);
    taskStore = nextStore;
    showStorageStatus(message, false);
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

renderTasks();
