import { expect, test } from "@playwright/test";

const EXPECTED_RELEASE = "20260729-card-visibility-1";
const EXPECTED_RELEASE_ENTRY = "release-entry.js?v=20260729-4";

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
    return page.locator('meta[name="study-canvas-release"]').getAttribute("content");
  }, {
    timeout: process.env.PLAYWRIGHT_BASE_URL ? 600_000 : 10_000,
    intervals: [1_000, 3_000, 5_000, 10_000, 15_000],
  }).toBe(EXPECTED_RELEASE);

  await expect(page.locator("#homeScreen")).toBeVisible();
  await expect(page.locator('script[src^="release-entry.js"]')).toHaveAttribute("src", EXPECTED_RELEASE_ENTRY);
  await expect(page.locator("body")).not.toContainText("予定時間");
  await expect(page.locator("body")).not.toContainText("学習時間の集計");
  await expect(page.locator("body")).not.toContainText("AIで読み取る");
  await expect(page.locator("#taskMinutes")).toHaveCount(0);
  await expect(page.locator('script[src*="weekly-recognition"]')).toHaveCount(0);
  expect(errors, errors.join("\n")).toEqual([]);
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
