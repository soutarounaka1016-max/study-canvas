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

async function waitForAppModules(page) {
  await expect(page.locator(".note-gallery-card").first()).toBeAttached();
  await expect(page.locator(".full-restore-dialog")).toBeAttached();
  await expect(page.locator("html")).toHaveAttribute("data-weekly-text-ready", "true");
  await expect(page.locator("html")).not.toHaveAttribute("data-note-load-error", "true");
}

async function gotoCleanHome(page) {
  await page.goto(`./?release-gate=${Date.now()}#home`, { waitUntil: "domcontentloaded" });
  await waitForAppModules(page);
  await page.evaluate((keys) => {
    for (const key of Object.values(keys)) localStorage.removeItem(key);
  }, STORAGE_KEYS);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppModules(page);
  await expect(page.locator("#homeScreen")).toBeVisible();
}

async function drawStroke(page, selector, from = [0.28, 0.3], to = [0.58, 0.48]) {
  const canvas = page.locator(selector);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 8 });
  await page.mouse.up();
}

async function dragWeeklyCardToCanvas(page, title, position = [0.4, 0.3]) {
  const handle = page.locator(".daily-weekly-card", { hasText: title }).locator(".daily-weekly-drag-handle");
  const canvas = page.locator("#dailyCanvasStage");
  await handle.scrollIntoViewIfNeeded();
  const handleBox = await handle.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(handleBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    canvasBox.x + canvasBox.width * position[0],
    canvasBox.y + canvasBox.height * position[1],
    { steps: 12 },
  );
  await page.mouse.up();
}

async function expectStored(page, key, text) {
  const raw = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
  expect(raw).toBeTruthy();
  if (text) expect(raw).toContain(text);
  return raw;
}

test("@published Version 0.3 Release Gateを公開ユーザー経路で完走する", async ({ page }, testInfo) => {
  test.setTimeout(process.env.PLAYWRIGHT_BASE_URL ? 240_000 : 120_000);
  const errors = watchCriticalErrors(page);
  await gotoCleanHome(page);

  await page.locator('[data-home-route="weekly"]').click();
  const math = page.locator('.weekly-subject-editor[data-subject="数学"]');
  await math.locator("textarea").fill("微積分 3問\n1対1対応 p.42〜47");
  await math.getByRole("button", { name: "カードを作成" }).click();
  await expect(math.locator(".weekly-text-card")).toHaveCount(2);
  await expectStored(page, STORAGE_KEYS.weeklyCards, "微積分 3問");
  await math.locator(".weekly-text-card").first().locator("input").fill("微積分 4問");
  await math.locator(".weekly-text-card").first().getByRole("button", { name: "保存" }).click();
  await expect(math).toContainText("カードを更新しました");
  await page.locator("#closeWeeklyDialogButton").click();

  await page.locator('[data-home-route="daily"]').click();
  await expect(page.locator("#dailyWeeklyShelf")).toContainText("微積分 4問");
  await dragWeeklyCardToCanvas(page, "微積分 4問");
  await expect(page.locator(".canvas-task-card")).toContainText("微積分 4問");
  const linkedRaw = await expectStored(page, STORAGE_KEYS.tasks, "sourceWeeklyCardId");
  expect(linkedRaw).toContain("微積分 4問");
  await expect(page.locator(".daily-weekly-card", { hasText: "微積分 4問" })).toContainText("今日に配置済み");

  const firstPosition = JSON.parse(linkedRaw).tasksByDate;
  const firstTask = Object.values(firstPosition)[0][0];
  const cardHandle = page.locator(".canvas-task-card", { hasText: "微積分 4問" }).locator(".canvas-task-drag-handle");
  const cardHandleBox = await cardHandle.boundingBox();
  const canvasBox = await page.locator("#dailyCanvasStage").boundingBox();
  await page.mouse.move(cardHandleBox.x + 10, cardHandleBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.7, canvasBox.y + canvasBox.height * 0.6, { steps: 10 });
  await page.mouse.up();
  const movedRaw = await expectStored(page, STORAGE_KEYS.tasks);
  const movedTask = Object.values(JSON.parse(movedRaw).tasksByDate)[0][0];
  expect(movedTask.x !== firstTask.x || movedTask.y !== firstTask.y).toBe(true);

  await page.locator(".canvas-task-card", { hasText: "微積分 4問" }).locator(".canvas-task-checkbox").check();
  await expect(page.locator(".daily-weekly-card", { hasText: "微積分 4問" })).toContainText("完了");
  await drawStroke(page, "#drawingCanvas");
  await expectStored(page, STORAGE_KEYS.pages);

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppModules(page);
  await expect(page.locator(".canvas-task-card", { hasText: "微積分 4問" })).toBeVisible();
  await expect(page.locator(".canvas-task-checkbox")).toBeChecked();
  await expect(page.locator(".daily-weekly-card", { hasText: "微積分 4問" })).toContainText("完了");

  await page.locator("#homeButton").click();
  await page.locator('[data-home-route="notes"]').click();
  await page.locator("#createNoteCardButton").click();
  await page.locator("#noteTitleInput").fill("Release Gate 自由ノート");
  await page.locator("#noteTitleInput").blur();
  await drawStroke(page, "#noteCanvas", [0.25, 0.3], [0.64, 0.5]);
  await expect(page.locator("#noteSaveStatus")).toHaveText("保存済み");
  await page.locator("#backToNoteGalleryButton").click();
  await expect(page.locator("#noteGallery")).toContainText("Release Gate 自由ノート");
  await page.locator("#closeNoteDialogButton").click();

  await page.locator('[data-home-route="backup"]').click();
  const backupDownloadPromise = page.waitForEvent("download");
  await page.locator("#backupButton").click();
  const backupDownload = await backupDownloadPromise;
  const backupPath = await backupDownload.path();
  const backupText = await readFile(backupPath, "utf8");
  expect(backupText).toContain("微積分 4問");
  expect(backupText).toContain("Release Gate 自由ノート");

  await page.evaluate((keys) => {
    for (const key of Object.values(keys)) localStorage.removeItem(key);
  }, STORAGE_KEYS);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppModules(page);
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

  await expectStored(page, STORAGE_KEYS.tasks, "微積分 4問");
  await expectStored(page, STORAGE_KEYS.weeklyCards, "微積分 4問");
  await expectStored(page, STORAGE_KEYS.notes, "Release Gate 自由ノート");
  await page.locator("#homeButton").click();
  await page.locator('[data-home-route="daily"]').click();
  await expect(page.locator(".canvas-task-card", { hasText: "微積分 4問" })).toBeVisible();

  const bodyText = await page.locator("body").innerText();
  for (const removed of ["AIで読み取る", "予定時間", "学習時間の集計", "準備中", "未実装"]) {
    expect(bodyText).not.toContain(removed);
  }
  await testInfo.attach("release-gate-daily", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  expect(errors, errors.join("\n")).toEqual([]);
});
