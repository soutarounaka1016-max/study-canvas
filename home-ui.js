import {
  homeRouteHash,
  normalizeHomeRoute,
} from "./src/home-route.js?v=20260729-1";

const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const homeScreen = document.createElement("main");
homeScreen.id = "homeScreen";
homeScreen.className = "home-screen";
homeScreen.innerHTML = `
  <div class="home-shell">
    <header class="home-heading">
      <div><h1>Study Canvas</h1><p>今日の目標を決め、3時間区切りのスケジュールへ配置できます。</p></div>
      <time id="homeDate" class="home-date">${formatLongDate(today)}</time>
    </header>
    <section class="home-today-card" aria-labelledby="homeTodayHeading">
      <div class="home-today-heading">
        <div><h2 id="homeTodayHeading">今日の目標と時間を決める</h2><p>週間カードを目標キャンバスへ置き、スケジュールで取り組む時間帯を決められます。</p></div>
      </div>
      <button class="home-primary-button" type="button" data-home-route="daily">今日のキャンバスを開く</button>
    </section>
    <h2 class="home-section-title">メニュー</h2>
    <section class="home-menu-grid" aria-label="主な機能">
      ${menuCard("weekly", "◎", "週間目標", "教科別にテキスト入力してカードを作る")}
      ${menuCard("notes", "▤", "自由ノート", "模試の反省や長期計画を手書きする")}
      ${menuCard("pages", "▦", "日付を選ぶ", "白紙の日を含むカレンダーから開く")}
      ${menuCard("backup", "⇩", "バックアップ・復元", "全データの保存と復元を行う")}
    </section>
  </div>
`;
document.body.prepend(homeScreen);

const homeButton = document.createElement("button");
homeButton.id = "homeButton";
homeButton.className = "icon-button home-nav-button";
homeButton.type = "button";
homeButton.setAttribute("aria-label", "ホームへ戻る");
homeButton.innerHTML = '<span aria-hidden="true">⌂</span><small>ホーム</small>';
document.querySelector(".document-bar")?.prepend(homeButton);

const weeklyDialog = document.querySelector("#weeklyDialog");
const noteDialog = document.querySelector("#noteDialog");
const pageListDialog = document.querySelector("#pageListDialog");
const menu = document.querySelector("details.menu");
const routeDialogs = new Map([
  ["weekly", weeklyDialog],
  ["notes", noteDialog],
  ["pages", pageListDialog],
]);

homeScreen.querySelectorAll("[data-home-route]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.homeRoute));
});
homeButton.addEventListener("click", () => navigate("home"));
window.addEventListener("hashchange", applyRoute);

for (const [route, dialog] of routeDialogs) {
  dialog?.addEventListener("close", () => {
    if (normalizeHomeRoute(location.hash) === route) navigate("home", true);
  });
}

pageListDialog?.addEventListener("click", (event) => {
  if (!event.target.closest(".page-card, .calendar-day-button")) return;
  history.replaceState(null, "", homeRouteHash("daily"));
});

if (!location.hash || normalizeHomeRoute(location.hash) === "home" && location.hash !== "#home") {
  history.replaceState(null, "", homeRouteHash("home"));
}
applyRoute();

function menuCard(route, icon, title, description) {
  return `
    <button class="home-menu-card" type="button" data-home-route="${route}">
      <span class="home-menu-icon" aria-hidden="true">${icon}</span>
      <span class="home-menu-text"><strong>${title}</strong><small>${description}</small></span>
      <span class="home-menu-arrow" aria-hidden="true">›</span>
    </button>
  `;
}

function navigate(route, replace = false) {
  const hash = homeRouteHash(route);
  if (replace) {
    history.replaceState(null, "", hash);
    applyRoute();
    return;
  }
  if (location.hash === hash) applyRoute();
  else location.hash = hash;
}

function applyRoute() {
  const route = normalizeHomeRoute(location.hash);
  const canonicalHash = homeRouteHash(route);
  if (location.hash !== canonicalHash) history.replaceState(null, "", canonicalHash);

  document.body.classList.toggle("is-home-route", route === "home");
  homeScreen.hidden = route !== "home";
  closeOtherDialogs(route);

  if (route === "home") {
    menu?.removeAttribute("open");
    document.title = "Study Canvas";
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }

  document.title = `${routeTitle(route)} | Study Canvas`;
  if (route !== "backup") menu?.removeAttribute("open");
  requestAnimationFrame(() => openRoute(route));
}

function openRoute(route) {
  window.dispatchEvent(new Event("resize"));
  if (route === "daily") {
    document.querySelector("#todayButton")?.click();
    document.querySelector("#drawingCanvas")?.focus?.();
    return;
  }
  if (route === "weekly") {
    if (!weeklyDialog?.open) document.querySelector("#weeklyButton")?.click();
    return;
  }
  if (route === "notes") {
    if (!noteDialog?.open) document.querySelector("#noteButton")?.click();
    return;
  }
  if (route === "pages") {
    if (!pageListDialog?.open) document.querySelector("#pageListButton")?.click();
    return;
  }
  if (route === "backup") {
    if (menu) menu.open = true;
    const backupButton = document.querySelector("#backupButton");
    backupButton?.scrollIntoView({ block: "center", behavior: "smooth" });
    backupButton?.focus();
  }
}

function closeOtherDialogs(route) {
  for (const [dialogRoute, dialog] of routeDialogs) {
    if (dialogRoute !== route && dialog?.open) dialog.close();
  }
}

function routeTitle(route) {
  return {
    daily: "今日のキャンバス",
    weekly: "週間目標",
    notes: "自由ノート",
    pages: "ページ一覧",
    backup: "バックアップ・復元",
  }[route] || "ホーム";
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00+09:00`));
}
