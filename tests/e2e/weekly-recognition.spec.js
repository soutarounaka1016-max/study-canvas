import { expect, test } from "@playwright/test";

const workerPattern = "https://study-canvas.soutarou-naka-1016.workers.dev/recognize";

async function openWeeklyRecognition(page) {
  await page.locator('summary[aria-label="メニュー"]').click();
  await page.locator("#weeklyButton").click();
  await expect(page.locator("#weeklyDialog")).toHaveAttribute("open", "");
  await page.locator("#weeklyRecognitionButton").click();
  await expect(page.locator("#weeklyRecognitionDialog")).toHaveAttribute("open", "");
}

test("AI候補を修正・選択してカード化し、再読み込み後も維持する", async ({ page }) => {
  await page.route(workerPattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        subject: "数学",
        weekStart: "2026-07-27",
        tasks: [
          { text: "1対1対応を5問", confidence: 0.92 },
          { text: "ベクトルを復習", confidence: 0.74 },
        ],
      }),
    });
  });

  await page.goto("/");
  await openWeeklyRecognition(page);
  await page.locator("#weeklyAiReadButton").click();
  await expect(page.locator("[data-candidate-text]")).toHaveCount(2);
  await page.locator('[data-candidate-text="0"]').fill("1対1対応の微積を5問");
  await page.locator('[data-candidate-selected="1"]').uncheck();
  await page.locator("#weeklySaveCandidatesButton").click();
  await expect(page.locator("#weeklySavedCardList")).toContainText("1対1対応の微積を5問");
  await expect(page.locator("#weeklySavedCardList")).not.toContainText("ベクトルを復習");

  const savedBeforeReload = await page.evaluate(() => localStorage.getItem("study-canvas:weekly-tasks:v1"));
  expect(savedBeforeReload).toContain("1対1対応の微積を5問");

  await page.reload();
  await openWeeklyRecognition(page);
  await expect(page.locator("#weeklySavedCardList")).toContainText("1対1対応の微積を5問");

  await page.unroute(workerPattern);
  await page.route(workerPattern, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "一時的に利用できません" } }) }));
  await page.locator("#weeklyAiReadButton").click();
  await expect(page.locator("#weeklyRecognitionStatus")).toContainText("既存データは変更されていません");
  const savedAfterFailure = await page.evaluate(() => localStorage.getItem("study-canvas:weekly-tasks:v1"));
  expect(savedAfterFailure).toBe(savedBeforeReload);
});
