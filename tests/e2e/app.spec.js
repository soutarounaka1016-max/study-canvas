import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const FACTORY_MANIFEST = JSON.parse(await readFile(new URL("../../factory-manifest.json", import.meta.url), "utf8"));
const EXPECTED_RELEASE = process.env.EXPECTED_RELEASE || FACTORY_MANIFEST.releaseId;

function watchCriticalErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error" || message.text().includes("favicon.ico")) return;
    errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function gotoHome(page) {
  await page.goto(`./?e2e=${Date.now()}#home`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#homeScreen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Study Canvas" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-weekly-text-ready", "true");
}

test("@published 最新版が起動しAI・時間UIがない", async ({ page }) => {
  test.setTimeout(process.env.PLAYWRIGHT_BASE_URL ? 660_000 : 30_000);
  const errors = watchCriticalErrors(page);
  await expect.poll(async () => {
    await page.goto(`./?release-check=${Date.now()}#home`, { waitUntil: "domcontentloaded" });
    return page.locator("html").getAttribute("data-release");
  }, {
    timeout: process.env.PLAYWRIGHT_BASE_URL ? 600_000 : 10_000,
    intervals: [1_000, 3_000, 5_000, 10_000, 15_000],
  }).toBe(EXPECTED_RELEASE);

  await expect(page.locator("#homeScreen")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-release-source", "git-commit-sha");
  await expect(page.locator('script[src^="release-entry.js?v="]')).toHaveCount(1);
  await expect(page.locator("body")).not.toContainText("予定時間");
  await expect(page.locator("body")).not.toContainText("学習時間の集計");
  await expect(page.locator("body")).not.toContainText("AIで読み取る");
  await expect(page.locator("#taskMinutes")).toHaveCount(0);
  await expect(page.locator('script[src*="weekly-recognition"]')).toHaveCount(0);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("@published 今日のスケジュールを作成し、手書き・カード・完了状態を保存する", async ({ page }) => {
  const errors = watchCriticalErrors(page);
  await gotoHome(page);
  await page.evaluate(() => {
    localStorage.setItem("study-canvas:tasks:v1", JSON.stringify({
      version: 1,
      tasksByDate: {
        [new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date())]: [{
          id: "schedule-e2e-task", subject: "数学", title: "微積を2題", plannedMinutes: 30,
          completed: false, x: 0.05, y: 0.05,
        }],
      },
    }));
    localStorage.removeItem("study-canvas:schedule:v1");
  });
  await page.reload();
  await page.locator('[data-home-route="daily"]').click();
  await page.locator('[data-daily-view="schedule"]').click();
  await expect(page.locator(".schedule-time-slot")).toHaveCount(8);
  await expect(page.locator("#scheduleCanvasWrap")).toBeVisible();
  await page.locator('[data-place-task="schedule-e2e-task"]').click();
  await page.locator('[data-place-task="schedule-e2e-task"]').click();
  await expect(page.locator('.schedule-task-card[data-task-id="schedule-e2e-task"]')).toHaveCount(2);

  const canvas = page.locator("#scheduleCanvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 180, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 240, box.y + 230, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("study-canvas:schedule:v1")).days[Object.keys(JSON.parse(localStorage.getItem("study-canvas:schedule:v1")).days)[0]].drawing.strokes.length)).toBe(1);

  await page.locator('.schedule-task-card[data-task-id="schedule-e2e-task"] input').first().check();
  const scheduleChecks = page.locator('.schedule-task-card[data-task-id="schedule-e2e-task"] input');
  await expect(scheduleChecks).toHaveCount(2);
  await expect(scheduleChecks.nth(0)).toBeChecked();
  await expect(scheduleChecks.nth(1)).toBeChecked();
  await page.locator('[data-daily-view="plan"]').click();
  await expect(page.locator('.canvas-task-card[data-task-id="schedule-e2e-task"] input')).toBeChecked();
  await page.reload();
  await expect(page.locator("#dailyViewTabs")).toBeVisible();
  await page.locator('[data-daily-view="schedule"]').click();
  await expect(page.locator('.schedule-task-card[data-task-id="schedule-e2e-task"]')).toHaveCount(2);
  await expect(page.locator('.schedule-task-card[data-task-id="schedule-e2e-task"] input').nth(0)).toBeChecked();
  await expect(page.locator('.schedule-task-card[data-task-id="schedule-e2e-task"] input').nth(1)).toBeChecked();
  expect(errors).toEqual([]);
});

test("主要画面へ移動し自由ノートを開ける", async ({ page }) => {
  const errors = watchCriticalErrors(page);
  await gotoHome(page);

  await page.locator('[data-home-route="daily"]').click();
  await expect(page.locator("#drawingCanvas")).toBeVisible();
  await expect(page.locator("#dailyWeeklyShelf")).toBeVisible();
  await page.locator("#homeButton").click();

  await page.locator('[data-home-route="weekly"]').click();
  await expect(page.locator("#weeklyDialog[open]")).toBeVisible();
  await expect(page.locator("#weeklySubjectGrid .weekly-subject-editor")).toHaveCount(5);
  await page.locator("#closeWeeklyDialogButton").click();
  await expect(page.locator("#homeScreen")).toBeVisible();

  await page.locator('[data-home-route="notes"]').click();
  await expect(page.locator("#noteDialog[open]")).toBeVisible();
  await expect(page.locator("#noteGallery")).toContainText("ノート 1");
  await page.locator("#closeNoteDialogButton").click();
  await expect(page.locator("#homeScreen")).toBeVisible();

  await page.locator('[data-home-route="pages"]').click();
  await expect(page.locator("#pageListDialog[open]")).toBeVisible();
  await page.locator("#closePageListButton").click();

  await page.locator('[data-home-route="backup"]').click();
  await expect(page.locator("details.menu")).toHaveAttribute("open", "");
  await expect(page.locator("#backupButton")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("白紙を含むすべての日付をカレンダーから開ける", async ({ page }) => {
  const errors = watchCriticalErrors(page);
  await gotoHome(page);
  await page.evaluate(() => {
    localStorage.removeItem("study-canvas:pages:v2");
    localStorage.removeItem("study-canvas:tasks:v1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-home-route="pages"]').click();

  const blankDay = page.locator(".calendar-day-button:not(.is-current)").first();
  await expect(blankDay).toBeEnabled();
  await expect(blankDay.locator(".calendar-writing-label")).toHaveText("白紙");
  const selectedDay = await blankDay.getAttribute("aria-label");
  await blankDay.click();

  await expect(page.locator("#pageListDialog")).not.toHaveAttribute("open", "");
  await expect(page.locator("#drawingCanvas")).toBeVisible();
  await expect(page.locator("#pageDate")).not.toHaveAttribute("datetime", "");
  await page.locator("#pageListButton").click();
  await expect(page.locator(".calendar-day-button.is-current")).toHaveAttribute("aria-label", selectedDay);

  await page.locator("#nextCalendarMonthButton").click();
  await expect(page.locator(".calendar-day-button").first()).toBeEnabled();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("日次上部は時間集計や追加ボタンではなく週間カード棚を使う", async ({ page }) => {
  const errors = watchCriticalErrors(page);
  await gotoHome(page);
  await page.locator('[data-home-route="daily"]').click();
  await expect(page.locator("#dailyWeeklyShelf")).toBeVisible();
  await expect(page.locator("#taskButton")).toBeHidden();
  await expect(page.locator("#taskMinutes")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("今日の集計");
  await expect(page.locator("body")).not.toContainText("今週の集計");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("ペン設定は書くボタンから開き、常時キャンバスを圧迫しない", async ({ page }) => {
  await gotoHome(page);
  await page.locator('[data-home-route="daily"]').click();
  await expect(page.locator("#penOptions")).toBeHidden();
  await page.locator("#penToolButton").click();
  await expect(page.locator("#penOptions")).toBeVisible();
  await expect(page.locator("#penOptions .color-button")).toHaveCount(3);
  await page.locator('[data-tool="eraser"]').click();
  await expect(page.locator("#penOptions")).toBeHidden();
});

test("主要部分が画面幅から大きくはみ出さない", async ({ page }) => {
  const errors = watchCriticalErrors(page);
  await gotoHome(page);
  await page.locator('[data-home-route="daily"]').click();

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    boxes: ["#dailyWeeklyShelf", ".workspace", ".page"].map((selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { selector, left: rect.left, right: rect.right } : { selector, missing: true };
    }),
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 4);
  for (const box of layout.boxes) {
    expect(box.missing, `${box.selector}が見つかりません`).not.toBe(true);
    expect(box.left).toBeGreaterThanOrEqual(-4);
    expect(box.right).toBeLessThanOrEqual(layout.viewportWidth + 4);
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("スマホ縦画面で主要操作が画面内に収まり44pxで押せる", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone-portrait", "スマホ縦向き専用の検査");
  const errors = watchCriticalErrors(page);
  await gotoHome(page);

  const expectNoHorizontalOverflow = async (selectors) => {
    const layout = await page.evaluate((targets) => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      boxes: targets.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return { selector, missing: true };
        const rect = element.getBoundingClientRect();
        return {
          selector,
          left: rect.left,
          right: rect.right,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
      }),
    }), selectors);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 2);
    for (const box of layout.boxes) {
      expect(box.missing, `${box.selector}が見つかりません`).not.toBe(true);
      expect(box.left, `${box.selector}の左端`).toBeGreaterThanOrEqual(-2);
      expect(box.right, `${box.selector}の右端`).toBeLessThanOrEqual(layout.viewportWidth + 2);
      expect(box.scrollWidth, `${box.selector}の内部幅`).toBeLessThanOrEqual(box.clientWidth + 2);
    }
  };

  await expectNoHorizontalOverflow(["#homeScreen", ".home-today-card", ".home-menu-grid"]);
  await page.locator('[data-home-route="daily"]').click();
  await expectNoHorizontalOverflow([".app-header", ".pen-options", "#dailyWeeklyShelf", ".workspace", ".page"]);

  const undersizedControls = await page.locator(
    ".app-header button, .app-header summary, .pen-options button, .daily-weekly-subject-tabs button",
  ).evaluateAll((elements) => elements
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    })
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        label: element.getAttribute("aria-label") || element.textContent.trim(),
        width: rect.width,
        height: rect.height,
      };
    })
    .filter(({ width, height }) => width < 43.5 || height < 43.5));
  expect(undersizedControls).toEqual([]);

  await page.locator("#homeButton").click();
  await page.locator('[data-home-route="weekly"]').click();
  await expect(page.locator("#weeklyDialog[open]")).toBeVisible();
  await expectNoHorizontalOverflow(["#weeklyDialog", ".weekly-dialog-header", ".weekly-week-nav", ".weekly-subject-grid"]);
  await expect(page.locator(".weekly-text-form textarea").first()).toHaveCSS("font-size", "16px");
  await page.locator("#closeWeeklyDialogButton").click();

  await page.locator('[data-home-route="notes"]').click();
  await expect(page.locator("#noteDialog[open]")).toBeVisible();
  await page.locator("#createNoteCardButton").click();
  await expectNoHorizontalOverflow(["#noteDialog", ".note-editor-header", ".note-toolbar", ".note-canvas-wrap"]);
  await page.locator("#closeNoteDialogButton").click();

  await page.locator('[data-home-route="pages"]').click();
  await expect(page.locator("#pageListDialog[open]")).toBeVisible();
  await expectNoHorizontalOverflow(["#pageListDialog", ".calendar-nav", "#pageList"]);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("@published OCR実験版を別保存領域で開ける", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "公開後だけ確認する観賞版");
  const errors = watchCriticalErrors(page);
  await page.goto(`./ocr-experiment/?archive=${Date.now()}#home`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".ocr-archive-banner")).toContainText("OCR実験版");
  await expect(page.locator('meta[name="study-canvas-release"]')).toHaveAttribute("content", "20260728-ocr-grounding-1");
  const keys = await page.evaluate(() => {
    localStorage.setItem("study-canvas-ocr-archive:test", "ok");
    return Object.keys(localStorage);
  });
  expect(keys).toContain("study-canvas-ocr-archive:test");
  expect(keys.some((key) => key.startsWith("study-canvas:"))).toBe(false);
  expect(errors, errors.join("\n")).toEqual([]);
});
