import "./taskize-entry.js?v=20260720-10";
import { calculateMonthGrid } from "./src/canvas-viewport.js?v=20260720-5";

const PAGE_STORE_KEY = "study-canvas:pages:v2";
const pageDate = document.querySelector("#pageDate");
const todayButton = document.querySelector("#todayButton");
const pageListButton = document.querySelector("#pageListButton");
const pageList = document.querySelector("#pageList");
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
    const button = original || document.createElement("button");
    const thumbnail = original?.querySelector("canvas") || null;
    button.type = "button";
    button.className = "calendar-day-button";
    button.classList.toggle("has-writing", Boolean(original));
    button.classList.toggle("is-current", date === activeDate);
    button.classList.toggle("is-today", date === today);
    button.disabled = !original;
    button.setAttribute("aria-label", original ? `${formatDate(date)}のページを開く` : `${formatDate(date)}は白紙です`);

    const dayNumber = document.createElement("span");
    dayNumber.className = "calendar-day-number";
    dayNumber.textContent = String(day);
    const writingLabel = document.createElement("span");
    writingLabel.className = "calendar-writing-label";
    writingLabel.textContent = original ? "手書きあり" : "白紙";
    button.replaceChildren(dayNumber);
    if (thumbnail) button.append(thumbnail);
    button.append(writingLabel);
    pageList.append(button);
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
