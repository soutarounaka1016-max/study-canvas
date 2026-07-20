import {
  TASK_STORAGE_KEY,
  loadTaskStore,
  replaceStoredTaskStore,
} from "./src/task-store.js?v=20260720-8";
import {
  carryOverTasks,
  getCarryoverCandidates,
  getPreviousDate,
} from "./src/task-copy.js?v=20260720-8";

const pageDate = document.querySelector("#pageDate");
const taskBoard = document.querySelector("#taskBoard");
const dailyCanvasStage = document.querySelector("#dailyCanvasStage");

const carryoverButton = document.createElement("button");
carryoverButton.type = "button";
carryoverButton.className = "canvas-task-carryover-button";
carryoverButton.hidden = true;
carryoverButton.setAttribute("aria-label", "\u524d\u65e5\u306e\u672a\u5b8c\u4e86\u30bf\u30b9\u30af\u3092\u4eca\u65e5\u3078\u8ffd\u52a0");
(taskBoard || dailyCanvasStage).append(carryoverButton);

const carryoverDialog = document.createElement("dialog");
carryoverDialog.className = "carryover-dialog";
carryoverDialog.innerHTML = `
  <form method="dialog" class="carryover-dialog-form">
    <div class="carryover-dialog-header">
      <div>
        <h2>\u524d\u65e5\u306e\u672a\u5b8c\u4e86\u30bf\u30b9\u30af</h2>
        <p id="carryoverDescription"></p>
      </div>
      <button class="dialog-close-button" value="cancel" aria-label="\u9589\u3058\u308b">\u00d7</button>
    </div>
    <div id="carryoverTaskList" class="carryover-task-list"></div>
    <p id="carryoverMessage" class="carryover-message" role="status" aria-live="polite" hidden></p>
    <div class="carryover-dialog-actions">
      <button id="carryoverSelectAllButton" type="button">\u3059\u3079\u3066\u9078\u629e</button>
      <button value="cancel">\u30ad\u30e3\u30f3\u30bb\u30eb</button>
      <button id="confirmCarryoverButton" class="carryover-primary-button" type="button">\u9078\u3093\u3060\u30bf\u30b9\u30af\u3092\u4eca\u65e5\u3078\u8ffd\u52a0</button>
    </div>
  </form>
`;
document.body.append(carryoverDialog);

const description = carryoverDialog.querySelector("#carryoverDescription");
const taskList = carryoverDialog.querySelector("#carryoverTaskList");
const message = carryoverDialog.querySelector("#carryoverMessage");
const selectAllButton = carryoverDialog.querySelector("#carryoverSelectAllButton");
const confirmButton = carryoverDialog.querySelector("#confirmCarryoverButton");

let activeCandidates = [];

carryoverButton.addEventListener("pointerdown", (event) => event.stopPropagation());
carryoverButton.addEventListener("click", openCarryoverDialog);
selectAllButton.addEventListener("click", toggleAllCandidates);
confirmButton.addEventListener("click", confirmCarryover);
carryoverDialog.addEventListener("close", () => {
  hideMessage();
  confirmButton.disabled = false;
});

for (const eventName of ["pointerdown", "selectstart", "contextmenu", "dblclick"]) {
  carryoverDialog.addEventListener(eventName, (event) => event.stopPropagation());
}

new MutationObserver(refreshCarryoverButton).observe(pageDate, {
  attributes: true,
  attributeFilter: ["datetime"],
});

function refreshCarryoverButton() {
  const targetDate = pageDate.dateTime;
  if (!targetDate || targetDate !== todayInTokyo()) {
    carryoverButton.hidden = true;
    return;
  }

  const store = readTaskStore();
  const candidates = getCarryoverCandidates(store, targetDate);
  carryoverButton.hidden = candidates.length === 0;
  carryoverButton.textContent = `\u524d\u65e5\u306e\u672a\u5b8c\u4e86 ${candidates.length}\u4ef6`;
}

function openCarryoverDialog() {
  const targetDate = pageDate.dateTime;
  const store = readTaskStore();
  activeCandidates = getCarryoverCandidates(store, targetDate);
  if (activeCandidates.length === 0) {
    refreshCarryoverButton();
    return;
  }

  const sourceDate = getPreviousDate(targetDate);
  description.textContent = `${formatDate(sourceDate)}\u306e\u672a\u5b8c\u4e86\u304b\u3089\u3001\u4eca\u65e5\u3084\u308b\u3082\u306e\u3060\u3051\u9078\u3073\u307e\u3059\u3002`;
  taskList.replaceChildren(...activeCandidates.map(createCandidateRow));
  updateSelectionState();
  hideMessage();
  carryoverDialog.showModal();
}

function createCandidateRow(task) {
  const label = document.createElement("label");
  label.className = "carryover-task-row";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = task.id;
  checkbox.checked = true;
  checkbox.addEventListener("change", updateSelectionState);

  const body = document.createElement("span");
  body.className = "carryover-task-body";

  const heading = document.createElement("span");
  heading.className = "carryover-task-heading";

  const subject = document.createElement("b");
  subject.textContent = task.subject;

  const title = document.createElement("strong");
  title.textContent = task.title;

  const minutes = document.createElement("small");
  minutes.textContent = `\u4e88\u5b9a ${task.plannedMinutes}\u5206`;

  heading.append(subject, title);
  body.append(heading, minutes);
  label.append(checkbox, body);
  return label;
}

function toggleAllCandidates() {
  const checkboxes = getCandidateCheckboxes();
  const shouldSelect = checkboxes.some((checkbox) => !checkbox.checked);
  for (const checkbox of checkboxes) checkbox.checked = shouldSelect;
  updateSelectionState();
}

function updateSelectionState() {
  const checkboxes = getCandidateCheckboxes();
  const selectedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
  confirmButton.disabled = selectedCount === 0;
  selectAllButton.textContent = selectedCount === checkboxes.length
    ? "\u3059\u3079\u3066\u89e3\u9664"
    : "\u3059\u3079\u3066\u9078\u629e";
}

function confirmCarryover() {
  const selectedIds = getCandidateCheckboxes()
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);

  if (selectedIds.length === 0) {
    showMessage("\u7e70\u308a\u8d8a\u3059\u30bf\u30b9\u30af\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044\u3002", true);
    return;
  }

  try {
    const targetDate = pageDate.dateTime;
    const currentStore = readTaskStore();
    const nextStore = carryOverTasks(currentStore, targetDate, selectedIds, createTaskId);
    replaceStoredTaskStore(localStorage, TASK_STORAGE_KEY, nextStore);
    confirmButton.disabled = true;
    showMessage(`${selectedIds.length}\u4ef6\u3092\u4eca\u65e5\u3078\u8ffd\u52a0\u3057\u307e\u3057\u305f\u3002\u753b\u9762\u3092\u66f4\u65b0\u3057\u307e\u3059\u3002`, false);
    window.setTimeout(() => window.location.reload(), 450);
  } catch (error) {
    const text = error?.message === "TASK_NOT_AVAILABLE"
      ? "\u3059\u3067\u306b\u8ffd\u52a0\u3055\u308c\u305f\u30bf\u30b9\u30af\u304c\u3042\u308a\u307e\u3059\u3002\u4e00\u5ea6\u9589\u3058\u3066\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002"
      : "\u30bf\u30b9\u30af\u3092\u4fdd\u5b58\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002";
    showMessage(text, true);
  }
}

function getCandidateCheckboxes() {
  return [...taskList.querySelectorAll('input[type="checkbox"]')];
}

function readTaskStore() {
  return loadTaskStore(localStorage.getItem(TASK_STORAGE_KEY)).store;
}

function showMessage(text, isError) {
  message.textContent = text;
  message.classList.toggle("is-error", isError);
  message.hidden = false;
}

function hideMessage() {
  message.hidden = true;
  message.textContent = "";
  message.classList.remove("is-error");
}

function createTaskId() {
  return globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayInTokyo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00+09:00`));
}

refreshCarryoverButton();
