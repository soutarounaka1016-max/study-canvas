import { calculateMonthGrid } from "./src/canvas-viewport.js?v=20260720-5";

const PAGE_STORE_KEY = "study-canvas:pages:v2";
const TASK_STORE_KEY = "study-canvas:tasks:v1";
const pageDate = document.querySelector("#pageDate");
const todayButton = document.querySelector("#todayButton");
const pageListButton = document.querySelector("#pageListButton");
const pageList = document.querySelector("#pageList");
const pageListDialog = document.querySelector("#pageListDialog");
const emptyPageList = document.querySelector("#emptyPageList");
const previousMonthButton = document.querySelector("#previousCalendarMonthButton");
const nextMonthButton = document.querySelector("#nextCalendarMonthButton");
const calendarMonthLabel = document.querySelector("#calendarMonthLabel");

const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

let calendarMonth = today.slice(0, 7);
let writtenPageButtons = new Map();

const dateObserver = new MutationObserver(updateTodayLamp);
dateObserver.observe(pageDate, { attributes: true, attributeFilter: ["datetime"] });
updateTodayLamp();

pageListButton.addEventListener("click", () => {
  calendarMonth = (pageDate.dateTime || today).slice(0, 7);
  requestAnimationFrame(() => {
    captureWrittenPageButtons();
    renderCalendar();
  });
});

previousMonthButton.addEventListener("click", () => {
  calendarMonth = shiftMonth(calendarMonth, -1);
  renderCalendar();
});
nextMonthButton.addEventListener("click", () => {
  calendarMonth = shiftMonth(calendarMonth, 1);
  renderCalendar();
});
document.addEventListener("study-canvas:tasks-changed", () => {
  if (pageListDialog.open) renderCalendar();
});

function updateTodayLamp() {
  const isToday = pageDate.dateTime === today;
  todayButton.classList.toggle("is-today", isToday);
  todayButton.setAttribute("aria-current", isToday ? "date" : "false");
}

function captureWrittenPageButtons() {
  const dates = readWrittenDates();
  const buttons = [...pageList.querySelectorAll(".page-card")];
  writtenPageButtons = new Map(dates.map((date, index) => [date, buttons[index]]));
}

function renderCalendar() {
  const [year, month] = calendarMonth.split("-").map(Number);
  const { firstWeekday, dayCount } = calculateMonthGrid(year, month);
  const activeDate = pageDate.dateTime || today;
  const tasksByDate = readTasksByDate();
  const formatter = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" });
  calendarMonthLabel.textContent = formatter.format(new Date(Date.UTC(year, month - 1, 1)));
  pageList.className = "page-list calendar-grid";
  pageList.replaceChildren();
  emptyPageList.hidden = true;

  for (const weekday of ["日", "月", "火", "水", "木", "金", "土"]) {
    const label = document.createElement("div");
    label.className = "calendar-weekday";
    label.textContent = weekday;
    pageList.append(label);
  }

  for (let index = 0; index < firstWeekday; index += 1) {
    const placeholder = document.createElement("div");
    placeholder.className = "calendar-day-placeholder";
    pageList.append(placeholder);
  }

  for (let day = 1; day <= dayCount; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const original = writtenPageButtons.get(date);
    const tasks = tasksByDate.get(date) || [];
    const button = original || document.createElement("button");
    const thumbnail = original?.querySelector("canvas") || null;
    button.type = "button";
    button.className = "calendar-day-button";
    button.classList.toggle("has-writing", Boolean(original));
    button.classList.toggle("has-tasks", tasks.length > 0);
    button.classList.toggle("is-current", date === activeDate);
    button.classList.toggle("is-today", date === today);
    button.disabled = false;
    button.setAttribute("aria-label", `${formatDate(date)}のページを開く${original ? "、手書きあり" : ""}${tasks.length > 0 ? `、タスク${tasks.length}件あり` : ""}`);
    if (!original) {
      button.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("study-canvas:open-date", { detail: { date } }));
      });
    }

    const dayNumber = document.createElement("span");
    dayNumber.className = "calendar-day-number";
    dayNumber.textContent = String(day);
    const writingLabel = document.createElement("span");
    writingLabel.className = "calendar-writing-label";
    writingLabel.textContent = [
      original ? "手書きあり" : "",
      tasks.length > 0 ? `タスク${tasks.length}件` : "",
    ].filter(Boolean).join("・") || "白紙";
    const preview = document.createElement("span");
    preview.className = "calendar-page-preview";
    if (thumbnail) preview.append(thumbnail);
    for (const task of tasks.slice(0, 4)) {
      const miniCard = document.createElement("span");
      miniCard.className = "calendar-task-mini-card";
      miniCard.dataset.subject = task.subject;
      miniCard.textContent = task.title;
      miniCard.style.left = `${clamp(task.x, 0, 0.7) * 100}%`;
      miniCard.style.top = `${clamp(task.y, 0, 0.68) * 100}%`;
      preview.append(miniCard);
    }
    if (tasks.length > 4) {
      const more = document.createElement("span");
      more.className = "calendar-task-more";
      more.textContent = `ほか${tasks.length - 4}件`;
      preview.append(more);
    }
    button.replaceChildren(dayNumber, preview, writingLabel);
    pageList.append(button);
  }
}

function readTasksByDate() {
  try {
    const value = JSON.parse(localStorage.getItem(TASK_STORE_KEY) || "null");
    return new Map(Object.entries(value?.tasksByDate || value?.days || {})
      .filter(([, tasks]) => Array.isArray(tasks) && tasks.length > 0)
      .map(([date, tasks]) => [date, tasks.filter((task) => (
        task
        && typeof task.title === "string"
        && typeof task.subject === "string"
      ))]));
  } catch {
    return new Map();
  }
}

function readWrittenDates() {
  try {
    const value = JSON.parse(localStorage.getItem(PAGE_STORE_KEY) || "null");
    return Object.entries(value?.pages || {})
      .filter(([, drawing]) => Array.isArray(drawing?.strokes) && drawing.strokes.length > 0)
      .map(([date]) => date)
      .sort((first, second) => second.localeCompare(first));
  } catch {
    return [];
  }
}

function shiftMonth(value, amount) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short",
  }).format(new Date(`${date}T00:00:00+09:00`));
}

function clamp(value, minimum, maximum) {
  const number = Number(value);
  return Math.min(maximum, Math.max(minimum, Number.isFinite(number) ? number : minimum));
}
