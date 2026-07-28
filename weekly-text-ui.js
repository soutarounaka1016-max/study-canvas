import { getWeekStart, shiftWeek } from "./src/weekly-store.js?v=20260729-1";
import {
  WEEKLY_CARD_STORAGE_KEY,
  WEEKLY_CARD_SUBJECTS,
  addWeeklyCards,
  deleteWeeklyCard,
  getWeeklyCards,
  loadWeeklyCardStore,
  replaceStoredWeeklyCardStore,
  updateWeeklyCard,
} from "./src/weekly-card-store.js?v=20260729-1";

const weeklyButton = document.querySelector("#weeklyButton");
const weeklyDialog = document.querySelector("#weeklyDialog");
const closeButton = document.querySelector("#closeWeeklyDialogButton");
const previousButton = document.querySelector("#previousWeekButton");
const currentButton = document.querySelector("#currentWeekButton");
const nextButton = document.querySelector("#nextWeekButton");
const rangeLabel = document.querySelector("#weeklyRange");
const pageDate = document.querySelector("#pageDate");
const subjectGrid = document.querySelector("#weeklySubjectGrid");

const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

let activeWeekStart = getWeekStart(pageDate?.dateTime || today);
let store = loadWeeklyCardStore(localStorage.getItem(WEEKLY_CARD_STORAGE_KEY)).store;

if (weeklyButton && weeklyDialog && subjectGrid) {
  subjectGrid.replaceChildren(...WEEKLY_CARD_SUBJECTS.map(createSubjectEditor));
  render();

  weeklyButton.addEventListener("click", () => {
    activeWeekStart = getWeekStart(pageDate?.dateTime || today);
    render();
    weeklyDialog.showModal();
  });
  closeButton?.addEventListener("click", () => weeklyDialog.close());
  previousButton?.addEventListener("click", () => {
    activeWeekStart = shiftWeek(activeWeekStart, -1);
    render();
  });
  currentButton?.addEventListener("click", () => {
    activeWeekStart = getWeekStart(today);
    render();
  });
  nextButton?.addEventListener("click", () => {
    activeWeekStart = shiftWeek(activeWeekStart, 1);
    render();
  });

  subjectGrid.addEventListener("submit", handleAddCards);
  subjectGrid.addEventListener("click", handleCardAction);
  document.documentElement.dataset.weeklyTextReady = "true";
  document.dispatchEvent(new CustomEvent("study-canvas:weekly-text-ready"));
}

function createSubjectEditor(subject) {
  const section = document.createElement("section");
  section.className = "weekly-subject-editor";
  section.dataset.subject = subject;
  section.innerHTML = `
    <header>
      <h3><span class="weekly-subject-dot" data-subject="${subject}"></span>${subject}</h3>
      <small data-card-count>0件</small>
    </header>
    <form class="weekly-text-form">
      <label>
        <span>${subject}の週間目標</span>
        <textarea maxlength="900" rows="3" placeholder="1行に1つ入力&#10;例：問題集 p.42〜47&#10;例：苦手分野を3問復習"></textarea>
      </label>
      <button type="submit">カードを作成</button>
    </form>
    <p class="weekly-subject-status" role="status" aria-live="polite" hidden></p>
    <div class="weekly-text-card-list" aria-label="${subject}の週間カード"></div>
  `;
  return section;
}

function handleAddCards(event) {
  const form = event.target.closest(".weekly-text-form");
  if (!form) return;
  event.preventDefault();
  const section = form.closest(".weekly-subject-editor");
  const subject = section.dataset.subject;
  const textarea = form.querySelector("textarea");
  const titles = [...new Set(
    textarea.value
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/\s+/g, " "))
      .filter(Boolean),
  )];
  if (titles.length === 0) {
    setStatus(section, "カードにする目標を1行以上入力してください。", true);
    return;
  }

  const existingTitles = new Set(getWeeklyCards(store, activeWeekStart, subject).map((card) => card.title));
  const newTitles = titles.filter((title) => !existingTitles.has(title));
  if (newTitles.length === 0) {
    setStatus(section, "同じ内容のカードがすでにあります。", true);
    return;
  }

  try {
    const createdAt = new Date().toISOString();
    const cards = newTitles.map((title, index) => ({
      id: createId(`weekly-${subject}-${index}`),
      title,
      confidence: 1,
      warning: "",
      createdAt,
      source: "manual",
    }));
    saveStore(addWeeklyCards(store, activeWeekStart, subject, cards));
    textarea.value = "";
    render();
    setStatus(section, `${cards.length}件のカードを作成しました。`);
  } catch (error) {
    setStatus(section, error?.message || "週間カードを保存できませんでした。", true);
  }
}

function handleCardAction(event) {
  const button = event.target.closest("[data-card-action]");
  if (!button) return;
  const section = button.closest(".weekly-subject-editor");
  const row = button.closest("[data-weekly-card-id]");
  const subject = section.dataset.subject;
  const cardId = row.dataset.weeklyCardId;

  try {
    if (button.dataset.cardAction === "save") {
      const title = row.querySelector("input").value;
      saveStore(updateWeeklyCard(store, activeWeekStart, subject, cardId, title));
      render();
      setStatus(section, "カードを更新しました。");
      return;
    }
    if (button.dataset.cardAction === "delete") {
      if (!window.confirm("この週間カードを削除しますか？")) return;
      saveStore(deleteWeeklyCard(store, activeWeekStart, subject, cardId));
      render();
      setStatus(section, "カードを削除しました。");
    }
  } catch (error) {
    setStatus(section, error?.message || "週間カードを変更できませんでした。", true);
  }
}

function saveStore(nextStore) {
  replaceStoredWeeklyCardStore(localStorage, WEEKLY_CARD_STORAGE_KEY, nextStore);
  store = nextStore;
  document.dispatchEvent(new CustomEvent("study-canvas:weekly-cards-changed"));
}

function render() {
  store = loadWeeklyCardStore(localStorage.getItem(WEEKLY_CARD_STORAGE_KEY)).store;
  rangeLabel.textContent = formatRange(activeWeekStart);
  for (const section of subjectGrid.querySelectorAll(".weekly-subject-editor")) {
    const subject = section.dataset.subject;
    const cards = getWeeklyCards(store, activeWeekStart, subject);
    section.querySelector("[data-card-count]").textContent = `${cards.length}件`;
    const list = section.querySelector(".weekly-text-card-list");
    list.innerHTML = cards.length === 0
      ? '<p class="weekly-text-empty">カードはまだありません。</p>'
      : cards.map((card) => `
        <article class="weekly-text-card" data-weekly-card-id="${escapeAttribute(card.id)}">
          <input type="text" maxlength="120" value="${escapeAttribute(card.title)}" aria-label="${escapeAttribute(subject)}のカード内容" />
          <button type="button" data-card-action="save">保存</button>
          <button class="weekly-card-delete" type="button" data-card-action="delete">削除</button>
        </article>
      `).join("");
  }
}

function setStatus(section, text, isError = false) {
  const target = section.querySelector(".weekly-subject-status");
  target.textContent = text;
  target.classList.toggle("is-error", isError);
  target.hidden = !text;
}

function formatRange(weekStart) {
  const start = new Date(`${weekStart}T00:00:00+09:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  });
  return `${formatter.format(start)}〜${formatter.format(end)}`;
}

function createId(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
