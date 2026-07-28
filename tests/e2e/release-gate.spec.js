import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const STORAGE_KEYS = {
  pages: "study-canvas:pages:v2",
  tasks: "study-canvas:tasks:v1",
  weekly: "study-canvas:weekly:v1",
  weeklyCards: "study-canvas:weekly-cards:v1",
  notes: "study-canvas:free-note:v1",
};

function watchCriticalErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error" || message.text().includes("favicon.ico")) return;
    errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function drawStroke(page, selector, from = [0.28, 0.3], to = [0.58, 0.48]) {
  const canvas = page.locator(selector);
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const startX = box.x + box.width * from[0];
  const startY = box.y + box.height * from[1];
  const endX = box.x + box.width * to[0];
  const endY = box.y + box.height * to[1];
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.mouse.up();
}

async function gotoCleanHome(page) {
  await page.goto(`./?release-gate=${Date.now()}#home`, { waitUntil: "domcontentloaded" });
  await page.evaluate((keys) => {
    for (const key of Object.values(keys)) localStorage.removeItem(key);
  }, STORAGE_KEYS);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#homeScreen")).toBeVisible();
}

async function expectStored(page, key, text) {
  const raw = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
  expect(raw).toBeTruthy();
  if (text) expect(raw).toContain(text);
  return raw;
}

async function expectDailyStrokeCount(page, date, count) {
  await expect.poll(async () => page.evaluate(({ key, targetDate }) => {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    try {
      return JSON.parse(raw)?.pages?.[targetDate]?.strokes?.length || 0;
    } catch {
      return 0;
    }
  }, { key: STORAGE_KEYS.pages, targetDate: date })).toBe(count);
}

test("@published Version 0.2 Release Gateを公開ユーザー経路で完走する", async ({ page }, testInfo) => {
  test.setTimeout(process.env.PLAYWRIGHT_BASE_URL ? 180_000 : 90_000);
  const errors = watchCriticalErrors(page);
  await gotoCleanHome(page);

  await page.locator('[data-home-route="daily"]').click();
  await expect(page.locator("#drawingCanvas")).toBeVisible();
  const firstDate = await page.locator("#pageDate").getAttribute("datetime");
  await drawStroke(page, "#drawingCanvas");
  await expectDailyStrokeCount(page, firstDate, 1);
  await expect(page.locator("#saveStatus")).toHaveText("保存済み");
  const firstPages = await expectStored(page, STORAGE_KEYS.pages);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#drawingCanvas")).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEYS.pages)).toBe(firstPages);

  await page.locator("#nextDateButton").click();
  await expect(page.locator("#pageDate")).not.toHaveAttribute("datetime", firstDate);
  const secondDate = await page.locator("#pageDate").getAttribute("datetime");
  await drawStroke(page, "#drawingCanvas", [0.34, 0.38], [0.62, 0.55]);
  await expectDailyStrokeCount(page, secondDate, 1);
  await expect(page.locator("#saveStatus")).toHaveText("保存済み");
  const separatedPages = JSON.parse(await expectStored(page, STORAGE_KEYS.pages));
  expect(separatedPages.pages[firstDate].strokes).toHaveLength(1);
  expect(separatedPages.pages[secondDate].strokes).toHaveLength(1);
  await page.locator("#previousDateButton").click();
  await expect(page.locator("#pageDate")).toHaveAttribute("datetime", firstDate);

  await page.locator("#taskButton").click();
  await page.locator("#taskSubject").selectOption({ label: "数学" });
  await page.locator("#taskTitle").fill("Release Gate 数学");
  await page.locator("#taskMinutes").fill("40");
  await page.locator("#saveTaskButton").click();
  await page.locator("#taskButton").click();
  await expect(page.locator("#taskList")).toContainText("Release Gate 数学");
  await page.locator("#taskList").getByRole("button", { name: "編集" }).click();
  await page.locator("#taskTitle").fill("Release Gate 数学・編集済み");
  await page.locator("#saveTaskButton").click();
  await page.locator("#taskButton").click();
  await page.locator("#taskList input[type=checkbox]").check();
  await expect(page.locator("#taskList .task-card")).toHaveClass(/is-completed/);
  await page.locator("#closeTaskDialogButton").click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#taskButton").click();
  await expect(page.locator("#taskList")).toContainText("Release Gate 数学・編集済み");
  await expect(page.locator("#taskList input[type=checkbox]")).toBeChecked();
  await page.locator("#closeTaskDialogButton").click();
  await page.locator("#homeButton").click();

  await page.locator('[data-home-route="weekly"]').click();
  await expect(page.locator("#weeklyDialog[open]")).toBeVisible();
  await drawStroke(page, "#weeklyCanvas", [0.2, 0.24], [0.66, 0.42]);
  await expect(page.locator("#weeklySaveStatus")).toHaveText("保存済み");
  await expectStored(page, STORAGE_KEYS.weekly);
  await page.locator("#closeWeeklyDialogButton").click();
  await expect(page.locator("#homeScreen")).toBeVisible();

  await page.locator('[data-home-route="notes"]').click();
  await expect(page.locator("#noteDialog[open]")).toBeVisible();
  await page.locator("#createNoteCardButton").click();
  await page.locator("#noteTitleInput").fill("Release Gate 自由ノート");
  await page.locator("#noteTitleInput").blur();
  await drawStroke(page, "#noteCanvas", [0.25, 0.3], [0.64, 0.5]);
  await expect(page.locator("#noteSaveStatus")).toHaveText("保存済み");
  await page.locator("#backToNoteGalleryButton").click();
  await expect(page.locator("#noteGallery")).toContainText("Release Gate 自由ノート");
  await page.locator("#closeNoteDialogButton").click();
  await expect(page.locator("#homeScreen")).toBeVisible();

  await page.locator('[data-home-route="backup"]').click();
  const backupDownloadPromise = page.waitForEvent("download");
  await page.locator("#backupButton").click();
  const backupDownload = await backupDownloadPromise;
  const backupPath = await backupDownload.path();
  expect(backupPath).toBeTruthy();
  const backupText = await readFile(backupPath, "utf8");
  expect(backupText).toContain("Release Gate 数学・編集済み");
  expect(backupText).toContain("Release Gate 自由ノート");
  await expect(page.locator("#backupStatus")).toContainText("バックアップを保存しました");

  await page.evaluate((keys) => {
    for (const key of Object.values(keys)) localStorage.removeItem(key);
  }, STORAGE_KEYS);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#restoreFile").setInputFiles({
    name: "release-gate-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(backupText),
  });
  await expect(page.locator(".full-restore-dialog[open]")).toBeVisible();
  const safetyBackupPromise = page.waitForEvent("download");
  await page.locator("#confirmFullRestoreButton").click();
  await safetyBackupPromise;
  await expect(page.locator(".full-restore-dialog[open]")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator("#homeScreen")).toBeVisible({ timeout: 10_000 });

  await expectStored(page, STORAGE_KEYS.pages);
  await expectStored(page, STORAGE_KEYS.tasks, "Release Gate 数学・編集済み");
  await expectStored(page, STORAGE_KEYS.weekly);
  await expectStored(page, STORAGE_KEYS.notes, "Release Gate 自由ノート");

  await page.locator('[data-home-route="daily"]').click();
  await page.locator("#taskButton").click();
  await expect(page.locator("#taskList")).toContainText("Release Gate 数学・編集済み");
  await expect(page.locator("#taskList input[type=checkbox]")).toBeChecked();
  await page.locator("#closeTaskDialogButton").click();
  await page.locator("#homeButton").click();

  await page.locator('[data-home-route="weekly"]').click();
  await expect(page.locator("#weeklyEmptyHint")).toBeHidden();
  const weeklyLayout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    canvasWidth: document.querySelector("#weeklyCanvas")?.getBoundingClientRect().width,
    tapTargets: [...document.querySelectorAll(".weekly-tool-button, .weekly-color-button, .weekly-history-actions button")]
      .filter((element) => !element.hidden)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { text: element.getAttribute("aria-label") || element.textContent.trim(), width: rect.width, height: rect.height };
      }),
  }));
  expect(weeklyLayout.documentWidth).toBeLessThanOrEqual(weeklyLayout.viewportWidth + 4);
  expect(weeklyLayout.canvasWidth).toBeGreaterThan(300);
  for (const target of weeklyLayout.tapTargets) {
    expect(target.width, `${target.text}の幅が小さすぎます`).toBeGreaterThanOrEqual(44);
    expect(target.height, `${target.text}の高さが小さすぎます`).toBeGreaterThanOrEqual(44);
  }
  await testInfo.attach("release-gate-weekly", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await page.locator("#closeWeeklyDialogButton").click();

  await page.locator('[data-home-route="notes"]').click();
  await expect(page.locator("#noteGallery")).toContainText("Release Gate 自由ノート");

  const bodyText = await page.locator("body").innerText();
  for (const unfinished of ["TODO", "FIXME", "準備中", "未実装", "Coming Soon", "ダミーデータ"]) {
    expect(bodyText).not.toContain(unfinished);
  }
  expect(errors, errors.join("\n")).toEqual([]);
});
