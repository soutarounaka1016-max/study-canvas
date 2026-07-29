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
} from "./src/task-store.js?v=20260729-1";
import { getWeekStart } from "./src/weekly-store.js?v=20260729-1";
import {
  WEEKLY_CARD_STORAGE_KEY,
  getWeeklyCardsForWeek,
  loadWeeklyCardStore,
} from "./src/weekly-card-store.js?v=20260729-1";

const pageDate = document.querySelector("#pageDate");
const taskButton = document.querySelector("#taskButton");
const taskCountBadge = document.querySelector("#taskCountBadge");
const taskDialog = document.querySelector("#taskDialog");
const closeTaskDialogButton = document.querySelector("#closeTaskDialogButton");
const taskDialogDate = document.querySelector("#taskDialogDate");
const taskForm = document.querySelector("#taskForm");
const taskSubject = document.querySelector("#taskSubject");
const taskTitle = document.querySelector("#taskTitle");
const saveTaskButton = document.querySelector("#saveTaskButton");
const cancelTaskEditButton = document.querySelector("#cancelTaskEditButton");
const taskFormError = document.querySelector("#taskFormError");
const taskProgress = document.querySelector("#taskProgress");
const taskStorageStatus = document.querySelector("#taskStorageStatus");
const emptyTaskList = document.querySelector("#emptyTaskList");
const taskList = document.querySelector("#taskList");
const dailyCanvasStage = document.querySelector("#dailyCanvasStage");
const workspace = document.querySelector(".workspace");
const WEEKLY_SUBJECT_FILTERS = ["すべて", "数学", "英語", "物理", "化学", "その他"];

const weeklyShelf = document.createElement("section");
weeklyShelf.id = "dailyWeeklyShelf";
weeklyShelf.className = "daily-weekly-shelf";
weeklyShelf.innerHTML = `
  <div class="daily-weekly-shelf-heading">
    <div>
      <h2>週間タスクカード</h2>
      <p>左の持ち手をつかみ、下の「今日の目標」へ置きます。</p>
    </div>
    <button id="openWeeklyFromShelf" type="button">週間目標を編集</button>
  </div>
  <div class="daily-weekly-subject-tabs" role="tablist" aria-label="週間タスクカードの教科">
    ${WEEKLY_SUBJECT_FILTERS.map((subject, index) => `
      <button type="button" role="tab" data-weekly-subject-filter="${subject}" aria-selected="${index === 0 ? "true" : "false"}">${subject}</button>
    `).join("")}
  </div>
  <p id="dailyWeeklyShelfStatus" class="daily-weekly-shelf-status" role="status" aria-live="polite" hidden></p>
  <div id="dailyWeeklyCardList" class="daily-weekly-card-list"></div>
`;
workspace.before(weeklyShelf);

const taskBoard = document.createElement("section");
taskBoard.id = "taskBoard";
taskBoard.className = "canvas-task-board";
taskBoard.setAttribute("aria-label", "今日の目標に置いたタスクカード");
dailyCanvasStage.append(taskBoard);

let activeDate = pageDate.dateTime;
let editingTaskId = null;
let canvasDragState = null;
let weeklyDragState = null;
let weeklySubjectFilter = "すべて";
let taskStore = loadTaskStore(localStorage.getItem(TASK_STORAGE_KEY)).store;

new MutationObserver(() => {
  const nextDate = pageDate.dateTime;
  if (!nextDate || nextDate === activeDate) return;
  activeDate = nextDate;
  resetForm();
  render();
}).observe(pageDate, { attributes: true, attributeFilter: ["datetime"] });

taskButton.addEventListener("click", openTaskDialog);
closeTaskDialogButton.addEventListener("click", () => taskDialog.close());
taskDialog.addEventListener("close", resetForm);
weeklyShelf.querySelector("#openWeeklyFromShelf").addEventListener("click", () => {
  document.querySelector("#weeklyButton")?.click();
});
weeklyShelf.addEventListener("pointerdown", startWeeklyCardDrag);
weeklyShelf.addEventListener("click", (event) => {
  const button = event.target.closest("[data-weekly-subject-filter]");
  if (!button) return;
  weeklySubjectFilter = button.dataset.weeklySubjectFilter;
  renderWeeklyShelf();
});

for (const eventName of ["selectstart", "contextmenu", "dblclick"]) {
  taskDialog.addEventListener(eventName, (event) => event.stopPropagation());
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  hideFormError();
  try {
    const existing = editingTaskId
      ? getTasksForDate(taskStore, activeDate).find((task) => task.id === editingTaskId)
      : null;
    const input = validateTaskInput({
      subject: taskSubject.value,
      title: taskTitle.value,
      plannedMinutes: existing?.plannedMinutes || 30,
      sourceWeeklyCardId: existing?.sourceWeeklyCardId,
    });
    const nextStore = editingTaskId
      ? updateTask(taskStore, activeDate, editingTaskId, input)
      : addTask(taskStore, activeDate, input, createTaskId("task"));
    if (persistTasks(nextStore, editingTaskId ? "タスクを更新しました" : "タスクを追加しました")) {
      resetForm();
      taskDialog.close();
    }
  } catch (error) {
    showFormError(error.message);
  }
});

cancelTaskEditButton.addEventListener("click", resetForm);
window.addEventListener("pointermove", handlePointerMove, { passive: false });
window.addEventListener("pointerup", finishPointerInteraction);
window.addEventListener("pointercancel", finishPointerInteraction);
document.addEventListener("study-canvas:weekly-cards-changed", renderWeeklyShelf);
window.addEventListener("storage", (event) => {
  if (event.key === TASK_STORAGE_KEY) {
    taskStore = loadTaskStore(localStorage.getItem(TASK_STORAGE_KEY)).store;
    render();
  }
  if (event.key === WEEKLY_CARD_STORAGE_KEY) renderWeeklyShelf();
});

function openTaskDialog() {
  activeDate = pageDate.dateTime;
  renderTasks();
  taskDialog.showModal();
}

function render() {
  taskStore = loadTaskStore(localStorage.getItem(TASK_STORAGE_KEY)).store;
  renderTasks();
  renderWeeklyShelf();
}

function renderTasks() {
  if (!activeDate) return;
  const tasks = getTasksForDate(taskStore, activeDate);
  const completedCount = tasks.filter((task) => task.completed).length;
  const remainingCount = tasks.length - completedCount;

  taskDialogDate.dateTime = activeDate;
  taskDialogDate.textContent = formatDate(activeDate);
  taskProgress.textContent = tasks.length > 0
    ? `${completedCount}/${tasks.length}件完了`
    : "タスクはまだありません";
  taskCountBadge.textContent = String(remainingCount);
  taskCountBadge.hidden = remainingCount === 0;
  emptyTaskList.hidden = tasks.length > 0;
  taskList.replaceChildren();
  taskBoard.replaceChildren();

  for (const task of tasks) {
    taskList.append(createDialogTaskCard(task));
    taskBoard.append(createCanvasTaskCard(task));
  }
  taskBoard.classList.toggle("has-tasks", tasks.length > 0);
}

function renderWeeklyShelf() {
  if (!activeDate) return;
  const weekStart = getWeekStart(activeDate);
  const weeklyStore = loadWeeklyCardStore(localStorage.getItem(WEEKLY_CARD_STORAGE_KEY)).store;
  const cards = getWeeklyCardsForWeek(weeklyStore, weekStart);
  const list = weeklyShelf.querySelector("#dailyWeeklyCardList");
  const visibleCards = weeklySubjectFilter === "すべて"
    ? cards
    : cards.filter((card) => card.subject === weeklySubjectFilter);
  list.replaceChildren();
  for (const button of weeklyShelf.querySelectorAll("[data-weekly-subject-filter]")) {
    const selected = button.dataset.weeklySubjectFilter === weeklySubjectFilter;
    button.setAttribute("aria-selected", String(selected));
    button.classList.toggle("is-selected", selected);
  }

  if (cards.length === 0) {
    const empty = document.createElement("p");
    empty.className = "daily-weekly-card-empty";
    empty.textContent = "この週のカードはまだありません。週間目標でテキスト入力すると、ここに並びます。";
    list.append(empty);
    return;
  }

  if (visibleCards.length === 0) {
    const empty = document.createElement("p");
    empty.className = "daily-weekly-card-empty";
    empty.textContent = `${weeklySubjectFilter}のカードはまだありません。`;
    list.append(empty);
    return;
  }

  for (const card of visibleCards) {
    const todayTask = getTasksForDate(taskStore, activeDate).find((task) => task.sourceWeeklyCardId === card.id);
    const article = document.createElement("article");
    article.className = "daily-weekly-card";
    article.dataset.weeklyCardId = card.id;
    article.dataset.subject = card.subject;
    article.dataset.title = card.title;
    article.innerHTML = `
      <button class="daily-weekly-drag-handle" type="button" aria-label="${escapeAttribute(card.title)}を今日の目標へ移動" ${todayTask ? 'aria-disabled="true"' : ""}>⠿</button>
      <div>
        <span class="daily-weekly-subject" data-subject="${escapeAttribute(card.subject)}">${escapeHtml(card.subject)}</span>
        <strong>${escapeHtml(card.title)}</strong>
      </div>
    `;
    list.append(article);
  }
}

function createDialogTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task-card";
  card.classList.toggle("is-completed", task.completed);
  card.dataset.subject = task.subject;

  const completionLabel = document.createElement("label");
  completionLabel.className = "task-completion";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  const body = document.createElement("div");
  body.className = "task-card-body";
  const heading = document.createElement("div");
  heading.className = "task-card-heading";
  const subject = document.createElement("span");
  subject.className = "task-subject";
  subject.dataset.subject = task.subject;
  subject.textContent = task.subject;
  const title = document.createElement("strong");
  title.textContent = task.title;
  const actions = document.createElement("div");
  actions.className = "task-card-actions";
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "編集";
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "task-delete-button";
  deleteButton.textContent = "削除";

  checkbox.addEventListener("change", () => toggleTaskCompletion(task));
  editButton.addEventListener("click", () => beginEdit(task));
  deleteButton.addEventListener("click", () => removeTask(task));

  completionLabel.append(checkbox);
  heading.append(subject, title);
  actions.append(editButton, deleteButton);
  body.append(heading, actions);
  card.append(completionLabel, body);
  return card;
}

function createCanvasTaskCard(task) {
  const card = document.createElement("article");
  card.className = "canvas-task-card";
  card.classList.toggle("is-completed", task.completed);
  card.style.left = `${task.x * 100}%`;
  card.style.top = `${task.y * 100}%`;
  card.dataset.taskId = task.id;
  card.dataset.subject = task.subject;

  const dragHandle = document.createElement("button");
  dragHandle.type = "button";
  dragHandle.className = "canvas-task-drag-handle";
  dragHandle.textContent = "⠿";
  dragHandle.setAttribute("aria-label", `${task.title}を移動`);
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "canvas-task-checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `${task.title}を${task.completed ? "未完了" : "完了"}にする`);
  const content = document.createElement("button");
  content.type = "button";
  content.className = "canvas-task-content";
  content.setAttribute("aria-label", `${task.title}を編集`);
  content.innerHTML = `
    <span class="canvas-task-subject" data-subject="${escapeAttribute(task.subject)}">${escapeHtml(task.subject)}</span>
    <strong>${escapeHtml(task.title)}</strong>
  `;

  dragHandle.addEventListener("pointerdown", (event) => startCanvasCardDrag(event, task, card));
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

  card.append(dragHandle, checkbox, content);
  return card;
}

function startCanvasCardDrag(event, task, card) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const rect = dailyCanvasStage.getBoundingClientRect();
  canvasDragState = {
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

function startWeeklyCardDrag(event) {
  const handle = event.target.closest(".daily-weekly-drag-handle");
  if (!handle) return;
  const card = handle.closest(".daily-weekly-card");
  if (handle.getAttribute("aria-disabled") === "true") {
    setShelfStatus("このカードは今日の目標に配置済みです。下のカードを動かしてください。");
    return;
  }
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();

  const ghost = card.cloneNode(true);
  ghost.className = "daily-weekly-drag-ghost";
  ghost.removeAttribute("data-weekly-card-id");
  ghost.style.left = `${event.clientX + 12}px`;
  ghost.style.top = `${event.clientY + 12}px`;
  document.body.append(ghost);
  weeklyDragState = {
    pointerId: event.pointerId,
    cardId: card.dataset.weeklyCardId,
    subject: card.dataset.subject,
    title: card.dataset.title,
    ghost,
    clientX: event.clientX,
    clientY: event.clientY,
  };
  document.body.classList.add("is-dragging-weekly-card");
}

function handlePointerMove(event) {
  if (canvasDragState && event.pointerId === canvasDragState.pointerId) {
    event.preventDefault();
    const { rect, card, offsetX, offsetY } = canvasDragState;
    const width = card.offsetWidth / rect.width;
    const height = card.offsetHeight / rect.height;
    const x = clamp((event.clientX - rect.left - offsetX) / rect.width, 0, 1 - width);
    const y = clamp((event.clientY - rect.top - offsetY) / rect.height, 0, 1 - height);
    card.style.left = `${x * 100}%`;
    card.style.top = `${y * 100}%`;
    canvasDragState.position = { x, y };
  }
  if (weeklyDragState && event.pointerId === weeklyDragState.pointerId) {
    event.preventDefault();
    weeklyDragState.clientX = event.clientX;
    weeklyDragState.clientY = event.clientY;
    weeklyDragState.ghost.style.left = `${event.clientX + 12}px`;
    weeklyDragState.ghost.style.top = `${event.clientY + 12}px`;
    dailyCanvasStage.classList.toggle("is-weekly-drop-target", isInside(event, dailyCanvasStage.getBoundingClientRect()));
  }
}

function finishPointerInteraction(event) {
  if (canvasDragState && event.pointerId === canvasDragState.pointerId) {
    const { task, card, position } = canvasDragState;
    card.classList.remove("is-dragging");
    document.body.classList.remove("is-dragging-task-card");
    canvasDragState = null;
    if (position) {
      try {
        persistTasks(updateTaskPosition(taskStore, activeDate, task.id, position), "カードの位置を保存しました", false);
      } catch {
        showStorageStatus("カードの位置を保存できませんでした。", true);
        renderTasks();
      }
    }
  }

  if (weeklyDragState && event.pointerId === weeklyDragState.pointerId) {
    const state = weeklyDragState;
    weeklyDragState = null;
    state.ghost.remove();
    document.body.classList.remove("is-dragging-weekly-card");
    dailyCanvasStage.classList.remove("is-weekly-drop-target");
    const rect = dailyCanvasStage.getBoundingClientRect();
    if (!isInside(state, rect)) {
      setShelfStatus("カードを「今日の目標」の中で離してください。");
      return;
    }
    placeWeeklyCard(state, rect);
  }
}

function placeWeeklyCard(card, rect) {
  const current = getTasksForDate(taskStore, activeDate);
  if (current.some((task) => task.sourceWeeklyCardId === card.cardId)) {
    setShelfStatus("このカードは今日の目標に配置済みです。");
    return;
  }
  try {
    const id = createTaskId("weekly-task");
    let next = addTask(taskStore, activeDate, {
      subject: card.subject,
      title: card.title,
      plannedMinutes: 30,
      sourceWeeklyCardId: card.cardId,
    }, id);
    const x = clamp((card.clientX - rect.left) / rect.width - 0.12, 0, 0.76);
    const y = clamp((card.clientY - rect.top) / rect.height - 0.09, 0, 0.82);
    next = updateTaskPosition(next, activeDate, id, { x, y });
    persistTasks(next, "週間カードを今日の目標へ配置しました。");
    setShelfStatus("カードを配置しました。");
  } catch (error) {
    setShelfStatus(error?.message || "カードを配置できませんでした。", true);
  }
}

function toggleTaskCompletion(task) {
  try {
    persistTasks(toggleTask(taskStore, activeDate, task.id), task.completed ? "未完了に戻しました。" : "完了にしました。");
  } catch {
    showStorageStatus("完了状態を保存できませんでした。", true);
    render();
  }
}

function removeTask(task) {
  if (!window.confirm(`「${task.title}」を削除しますか？`)) return;
  try {
    const nextStore = deleteTask(taskStore, activeDate, task.id);
    if (persistTasks(nextStore, "タスクを削除しました。") && editingTaskId === task.id) resetForm();
  } catch {
    showStorageStatus("タスクを削除できませんでした。", true);
  }
}

function beginEdit(task) {
  editingTaskId = task.id;
  taskSubject.value = task.subject;
  taskTitle.value = task.title;
  saveTaskButton.textContent = "変更を保存";
  cancelTaskEditButton.hidden = false;
  hideFormError();
  requestAnimationFrame(() => taskTitle.focus());
}

function resetForm() {
  editingTaskId = null;
  taskForm.reset();
  saveTaskButton.textContent = "タスクを追加";
  cancelTaskEditButton.hidden = true;
  hideFormError();
}

function persistTasks(nextStore, message, announce = true) {
  try {
    replaceStoredTaskStore(localStorage, TASK_STORAGE_KEY, nextStore);
    taskStore = nextStore;
    if (announce) showStorageStatus(message, false);
    render();
    document.dispatchEvent(new CustomEvent("study-canvas:tasks-changed"));
    return true;
  } catch {
    showStorageStatus("タスクを保存できませんでした。変更前の状態を維持しています。", true);
    render();
    return false;
  }
}

function getLinkedTasksForWeek(weekStart, weeklyCardId) {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return Object.entries(taskStore.tasksByDate || {})
    .filter(([date]) => {
      const parsed = new Date(`${date}T00:00:00Z`);
      return parsed >= start && parsed <= end;
    })
    .flatMap(([, tasks]) => tasks)
    .filter((task) => task.sourceWeeklyCardId === weeklyCardId);
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

function setShelfStatus(message, isError = false) {
  const target = weeklyShelf.querySelector("#dailyWeeklyShelfStatus");
  target.textContent = message;
  target.classList.toggle("is-error", isError);
  target.hidden = !message;
}

function createTaskId(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function isInside(point, rect) {
  return point.clientX >= rect.left
    && point.clientX <= rect.right
    && point.clientY >= rect.top
    && point.clientY <= rect.bottom;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

render();
