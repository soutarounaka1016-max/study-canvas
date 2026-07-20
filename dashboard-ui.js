import {
  TASK_STORAGE_KEY,
  getTasksForDate,
  loadTaskStore,
} from "./src/task-store.js?v=20260720-7";

const pageDate = document.querySelector("#pageDate");
const workspace = document.querySelector(".workspace");
const taskBoard = document.querySelector("#taskBoard");
const panel = document.createElement("section");
panel.className = "study-dashboard";
panel.innerHTML = `
  <button class="study-dashboard-toggle" type="button" aria-expanded="true">
    <span><b id="dashboardTitle">今日やること</b><small id="dashboardToggleSummary"></small></span>
    <span aria-hidden="true">⌃</span>
  </button>
  <div class="study-dashboard-body">
    <div class="study-dashboard-stats">
      <div><small>完了</small><strong id="dashboardProgress">0 / 0</strong></div>
      <div><small>残り</small><strong id="dashboardRemainingCount">0件</strong></div>
      <div><small>残り予定時間</small><strong id="dashboardRemainingMinutes">0分</strong></div>
      <div><small>全予定時間</small><strong id="dashboardTotalMinutes">0分</strong></div>
    </div>
    <div class="study-dashboard-actions">
      <button id="dashboardAddTask" type="button">＋ タスク追加</button>
      <button id="dashboardCarryover" type="button" hidden>前日の未完了を確認</button>
      <button id="dashboardWeekly" type="button">週間目標</button>
    </div>
    <p id="dashboardEmpty" class="study-dashboard-empty">この日のタスクはまだありません。</p>
    <div id="dashboardTaskList" class="study-dashboard-list"></div>
  </div>
`;
workspace.before(panel);

const toggle = panel.querySelector(".study-dashboard-toggle");
const body = panel.querySelector(".study-dashboard-body");
const title = panel.querySelector("#dashboardTitle");
const toggleSummary = panel.querySelector("#dashboardToggleSummary");
const progress = panel.querySelector("#dashboardProgress");
const remainingCount = panel.querySelector("#dashboardRemainingCount");
const remainingMinutes = panel.querySelector("#dashboardRemainingMinutes");
const totalMinutes = panel.querySelector("#dashboardTotalMinutes");
const empty = panel.querySelector("#dashboardEmpty");
const list = panel.querySelector("#dashboardTaskList");
const addButton = panel.querySelector("#dashboardAddTask");
const carryoverButton = panel.querySelector("#dashboardCarryover");
const weeklyButton = panel.querySelector("#dashboardWeekly");

toggle.addEventListener("click", () => {
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!expanded));
  body.hidden = expanded;
  toggle.lastElementChild.textContent = expanded ? "⌄" : "⌃";
});

addButton.addEventListener("click", () => {
  document.querySelector(".canvas-task-add-button")?.click();
});
carryoverButton.addEventListener("click", () => {
  document.querySelector(".canvas-task-carryover-button")?.click();
});
weeklyButton.addEventListener("click", () => document.querySelector("#weeklyButton")?.click());

new MutationObserver(render).observe(pageDate, {
  attributes: true,
  attributeFilter: ["datetime"],
});
if (taskBoard) {
  new MutationObserver(render).observe(taskBoard, { childList: true, subtree: true, attributes: true });
}
window.addEventListener("storage", (event) => {
  if (event.key === TASK_STORAGE_KEY) render();
});

function render() {
  const date = pageDate.dateTime;
  if (!date) return;
  const store = loadTaskStore(localStorage.getItem(TASK_STORAGE_KEY)).store;
  const tasks = getTasksForDate(store, date);
  let completed = 0;
  let total = 0;
  let remaining = 0;
  for (const task of tasks) {
    total += task.plannedMinutes;
    if (task.completed) completed += 1;
    else remaining += task.plannedMinutes;
  }

  title.textContent = date === todayInTokyo() ? "今日やること" : `${formatDate(date)}の予定`;
  progress.textContent = `${completed} / ${tasks.length}`;
  remainingCount.textContent = `${tasks.length - completed}件`;
  remainingMinutes.textContent = formatMinutes(remaining);
  totalMinutes.textContent = formatMinutes(total);
  toggleSummary.textContent = `残り${tasks.length - completed}件・${formatMinutes(remaining)}`;
  empty.hidden = tasks.length > 0;
  list.replaceChildren(...tasks.map(createTaskRow));

  const carryover = document.querySelector(".canvas-task-carryover-button");
  carryoverButton.hidden = date !== todayInTokyo() || !carryover || carryover.hidden;
}

function createTaskRow(task) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "study-dashboard-task";
  row.classList.toggle("is-completed", task.completed);
  row.dataset.taskId = task.id;

  const mark = document.createElement("span");
  mark.className = "study-dashboard-check";
  mark.textContent = task.completed ? "✓" : "";
  const text = document.createElement("span");
  const heading = document.createElement("strong");
  heading.textContent = task.title;
  const detail = document.createElement("small");
  detail.textContent = `${task.subject}・${task.plannedMinutes}分`;
  text.append(heading, detail);
  row.append(mark, text);

  row.addEventListener("click", () => {
    const selector = `.canvas-task-card[data-task-id="${CSS.escape(task.id)}"] .canvas-task-checkbox`;
    document.querySelector(selector)?.click();
    window.setTimeout(render, 0);
  });
  return row;
}

function formatMinutes(value) {
  const minutes = Math.max(0, Math.round(value));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}分`;
  return rest ? `${hours}時間${rest}分` : `${hours}時間`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00+09:00`));
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

render();
