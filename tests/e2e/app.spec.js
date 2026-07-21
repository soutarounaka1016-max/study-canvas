import { expect, test } from "@playwright/test";

const EXPECTED_RELEASE = "20260721-playwright-1";
const TASK_STORAGE_KEY = "study-canvas:tasks:v1";

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
  await page.goto(`/?e2e=${Date.now()}#home`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#homeScreen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Study Canvas" })).toBeVisible();
}

async function expectNoCriticalErrors(errors) {
  expect(errors, errors.join("\n")).toEqual([]);
}

test("@published 最新版が起動し重大なJavaScriptエラーがない", async ({ page }) => {
  const errors = watchCriticalErrors(page);
  await expect.poll(async () => {
    await page.goto(`/?release-check=${Date.now()}#home`, { waitUntil: "domcontentloaded" });
    return page.locator('meta[name="study-canvas-release"]').getAttribute("content");
  }, {
    message: "GitHub Pagesへ今回のリリースが反映されるのを待機",
    timeout: process.env.PLAYWRIGHT_BASE_URL ? 600_000 : 10_000,
    intervals: [1_000, 3_000, 5_000, 10_000, 15_000],
  }).toBe(EXPECTED_RELEASE);

  await expect(page.locator("#homeScreen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Study Canvas" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-note-load-error", "true");
  await expectNoCriticalErrors(errors);
});

test("主要画面へ移動し自由ノートを開ける", async ({ page }) => {
  const errors = watchCriticalErrors(page);
  await gotoHome(page);

  await page.getByRole("button", { name: "今日のキャンバスを開く" }).click();
  await expect(page.locator("#drawingCanvas")).toBeVisible();
  await page.locator("#homeButton").click();

  await page.getByRole("button", { name: /週間目標/ }).click();
  await expect(page.locator("#weeklyDialog[open]")).toBeVisible();
  await page.locator("#closeWeeklyDialogButton").click();
  await expect(page.locator("#homeScreen")).toBeVisible();

  await page.getByRole("button", { name: /自由ノート/ }).click();
  await expect(page.locator("#noteDialog[open]")).toBeVisible();
  await expect(page.locator("#noteGalleryView")).toBeVisible();
  await expect(page.locator("#noteGallery")).toContainText("ノート 1");
  await page.locator("#closeNoteDialogButton").click();
  await expect(page.locator("#homeScreen")).toBeVisible();

  await page.getByRole("button", { name: /学習時間の集計/ }).click();
  await expect(page.locator(".study-dashboard")).toBeVisible();
  await page.locator("#homeButton").click();

  await page.getByRole("button", { name: /ページ一覧/ }).click();
  await expect(page.locator("#pageListDialog[open]")).toBeVisible();
  await page.locator("#closePageListButton").click();

  await page.getByRole("button", { name: /バックアップ・復元/ }).click();
  await expect(page.locator("details.menu")).toHaveAttribute("open", "");
  await expect(page.locator("#backupButton")).toBeVisible();
  await expectNoCriticalErrors(errors);
});

test("主要操作で追加したタスクが再読み込み後も残る", async ({ page }) => {
  const errors = watchCriticalErrors(page);
  await gotoHome(page);
  await page.evaluate((key) => localStorage.removeItem(key), TASK_STORAGE_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "今日のキャンバスを開く" }).click();
  await page.locator("#taskButton").click();
  await expect(page.locator("#taskDialog[open]")).toBeVisible();
  await page.locator("#taskSubject").selectOption({ label: "数学" });
  await page.locator("#taskTitle").fill("Playwright確認タスク");
  await page.locator("#taskMinutes").fill("35");
  await page.locator("#taskForm").getByRole("button", { name: "タスクを追加" }).click();
  await expect(page.locator("#taskList")).toContainText("Playwright確認タスク");
  await expect(page.locator("#taskDialog")).not.toHaveAttribute("open", "");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#taskButton").click();
  await expect(page.locator("#taskList")).toContainText("Playwright確認タスク");
  await expectNoCriticalErrors(errors);
});

test("主要部分が画面幅から大きくはみ出さない", async ({ page }) => {
  const errors = watchCriticalErrors(page);
  await gotoHome(page);

  const layout = await page.evaluate(() => {
    const selectors = ["#homeScreen", ".home-shell", ".home-today-card", ".home-menu-grid"];
    const boxes = selectors.map((selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return rect ? { selector, left: rect.left, right: rect.right, width: rect.width } : { selector, missing: true };
    });
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      boxes,
    };
  });

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 4);
  for (const box of layout.boxes) {
    expect(box.missing, `${box.selector}が見つかりません`).not.toBe(true);
    expect(box.left, `${box.selector}が左へはみ出しています`).toBeGreaterThanOrEqual(-4);
    expect(box.right, `${box.selector}が右へはみ出しています`).toBeLessThanOrEqual(layout.viewportWidth + 4);
  }
  await expect(page.getByRole("button", { name: "今日のキャンバスを開く" })).toBeVisible();
  await expectNoCriticalErrors(errors);
});
