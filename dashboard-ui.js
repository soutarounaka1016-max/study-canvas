import {
  TASK_STORAGE_KEY,
  getTasksForDate,
  loadTaskStore,
} from "./src/task-store.js?v=20260720-7";
import {
  getWeekRange,
  summarizeTasksForDate,
  summarizeTasksForRange,
} from "./src/study-stats.js?v=20260721-1";

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
    <section class="study-dashboard-summary-section" aria-labelledby="dashboardDayHeading">
      <div class="study-dashboard-section-heading">
        <h3 id="dashboardDayHeading">今日の集計</h3>
      </div>
      <div class="study-dashboard-stats">
        <div><small>予定時間</small><strong id="dashboardDayPlanned">0分</strong></div>
        <div><small>完了換算</small><strong id="dashboardDayCompleted">0分</strong></div>
        <div><small>残り時間</small><strong id="dashboardDayRemaining">0分</strong></div>
        <div><small>達成率</small><strong id="dashboardDayRate">0%</strong></div>
      </div>
    </section>
    <section class="study-dashboard-summary-section study-dashboard-week-section" aria-labelledby="dashboardWeekHeading">
      <div class="study-dashboard-section-heading">
        <h3 id="dashboardWeekHeading">今週の集計</h3>
        <small id="dashboardWeekRange"></small>
      </div>
      <div class="study-dashboard-stats">
        <div><small>予定時間</small><strong id="dashboardWeekPlanned">0分</strong></div>
        <div><small>完了換算</small><strong id="dashboardWeekCompleted">0分</strong></div>
        <div><small>残り時間</small><strong id="dashboardWeekRemaining">0分</strong></div>
        <div><small>達成率</small><strong id="dashboardWeekRate">0%</strong></div>
      </div>
      <div class="study-dashboard-subjects">
        <div class="study-dashboard-subject-heading">
          <h4>科目別</h4>
          <small>完了換算 / 予定</small>
        </div>
        <p id="dashboardSubjectEmpty" class="study-dashboard-subject-empty">この週のタスクはまだありません。</p>
        <div id="dashboardSubjectList" class="study-dashboard-subject-list"></div>
      </div>
    </section>
    <p class="study-dashboard-definition">完了換算は、完了にしたタスクの予定時間です。実際に計測した勉強時間ではありません。</p>
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
const dayHeading = panel.querySelector("#dashboardDayHeading");
const dayPlanned = panel.querySelector("#dashboardDayPlanned");
const dayCompleted = panel.querySelector("#dashboardDayCompleted");
const dayRemaining = panel.querySelector("#dashboardDayRemaining");
const dayRate = panel.querySelector("#dashboardDayRate");
const weekHeading = panel.querySelector("#dashboardWeekHeading");
const weekRangeLabel = panel.querySelector("#dashboardWeekRange");
const weekPlanned = panel.querySelector("#dashboardWeekPlanned");
const weekCompleted = panel.querySelector("#dashboardWeekCompleted");
const weekRemaining = panel.querySelector("#dashboardWeekRemaining");
const weekRate = panel.querySelector("#dashboardWeekRate");
const subjectEmpty = panel.querySelector("#dashboardSubjectEmpty");
const subjectList = panel.querySelector("#dashboardSubjectList");
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
  const daySummary = summarizeTasksForDate(store, date);
  const weekRange = getWeekRange(date);
  const weekSummary = summarizeTasksForRange(store, weekRange.startDate, weekRange.endDate);
  const isToday = date === todayInTokyo();

  title.textContent = isToday ? "今日やること" : `${formatDate(date)}の予定`;
  dayHeading.textContent = isToday ? "今日の集計" : `${formatDate(date)}の集計`;
  dayPlanned.textContent = formatMinutes(daySummary.plannedMinutes);
  dayCompleted.textContent = formatMinutes(daySummary.completedMinutes);
  dayRemaining.textContent = formatMinutes(daySummary.remainingMinutes);
  dayRate.textContent = `${daySummary.completionRate}%`;

  weekHeading.textContent = isToday ? "今週の集計" : "この週の集計";
  weekRangeLabel.textContent = formatWeekRange(weekRange.startDate, weekRange.endDate);
  weekPlanned.textContent = formatMinutes(weekSummary.plannedMinutes);
  weekCompleted.textContent = formatMinutes(weekSummary.completedMinutes);
  weekRemaining.textContent = formatMinutes(weekSummary.remainingMinutes);
  weekRate.textContent = `${weekSummary.completionRate}%`;
  renderSubjects(weekSummary.subjectBreakdown);

  toggleSummary.textContent = `残り${daySummary.remainingTasks}件・${formatMinutes(daySummary.remainingMinutes)}・週${weekSummary.completionRate}%`;
  empty.hidden = tasks.length > 0;
  list.replaceChildren(...tasks.map(createTaskRow));

  const carryover = document.querySelector(".canvas-task-carryover-button");
  carryoverButton.hidden = !isToday || !carryover || carryover.hidden;
}

function renderSubjects(subjects) {
  subjectEmpty.hidden = subjects.length > 0;
  subjectList.replaceChildren(...subjects.map(createSubjectRow));
}

function createSubjectRow(subject) {
  const row = document.createElement("div");
  row.className = "study-dashboard-subject-row";

  const header = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = subject.subject;
  const value = document.createElement("span");
  value.textContent = `${formatMinutes(subject.completedMinutes)} / ${formatMinutes(subject.plannedMinutes)}`;
  header.append(name, value);

  const track = document.createElement("div");
  track.className = "study-dashboard-subject-track";
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", `${subject.subject}の達成率`);
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", String(subject.completionRate));
  const bar = document.createElement("span");
  bar.style.width = `${subject.completionRate}%`;
  track.append(bar);

  row.append(header, track);
  return row;
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

function formatWeekRange(startDate, endDate) {
  const start = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${startDate}T00:00:00+09:00`));
  const end = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${endDate}T00:00:00+09:00`));
  return `${start}〜${end}`;
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
