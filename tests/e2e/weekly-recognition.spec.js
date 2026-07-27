import { expect, test } from "@playwright/test";

const CARD_STORAGE_KEY = "study-canvas:weekly-cards:v1";
const ENDPOINT = "https://study-canvas.soutarou-naka-1016.workers.dev/recognize";

async function gotoHome(page) {
  await page.goto(`./?weekly-ai=${Date.now()}#home`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#homeScreen")).toBeVisible();
}

async function openWeeklyFromHome(page) {
  await page.locator('[data-home-route="weekly"]').click();
  await expect(page.locator("#weeklyDialog")).toHaveAttribute("open", "");
}

async function closeWeeklyToHome(page) {
  await page.locator("#closeWeeklyDialogButton").click();
  await expect(page.locator("#homeScreen")).toBeVisible();
}

test("AI候補を修正・選択してカード化し、再読み込み後も保持する", async ({ page }) => {
  await page.route(ENDPOINT, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ tasks: [
        { title: "青チャート 120〜130", confidence: 0.92, warning: "" },
        { title: "ベクトル復習", confidence: 0.74, warning: "数字なし" },
      ] }),
    });
  });

  await gotoHome(page);
  await page.evaluate((key) => localStorage.removeItem(key), CARD_STORAGE_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#homeScreen")).toBeVisible();
  await openWeeklyFromHome(page);

  await page.locator("#weeklyRecognitionButton").click();
  await expect(page.locator("#weeklyRecognitionDialog")).toHaveAttribute("open", "");
  await page.locator("#weeklyRunRecognition").click();
  await expect(page.locator(".weekly-candidate-row")).toHaveCount(2);

  await page.locator('.weekly-candidate-row input[type="text"]').first().fill("青チャート 125〜130");
  await page.locator('.weekly-candidate-row input[type="checkbox"]').nth(1).uncheck();
  await page.locator("#weeklySaveCandidates").click();
  await expect(page.locator("#weeklyRecognitionStatus")).toContainText("1件を週間カードとして保存");
  await page.locator('[data-close-recognition]').last().click();
  await expect(page.locator("#weeklyCardList")).toContainText("青チャート 125〜130");
  await expect(page.locator("#weeklyCardList")).not.toContainText("ベクトル復習");

  const savedBeforeReload = await page.evaluate((key) => localStorage.getItem(key), CARD_STORAGE_KEY);
  expect(savedBeforeReload).toContain("青チャート 125〜130");

  await closeWeeklyToHome(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#homeScreen")).toBeVisible();
  await openWeeklyFromHome(page);
  await expect(page.locator("#weeklyCardList")).toContainText("青チャート 125〜130");

  await page.unroute(ENDPOINT);
  await page.route(ENDPOINT, async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: { code: "AI_REQUEST_FAILED", message: "temporary" } }),
    });
  });
  await page.locator("#weeklyRecognitionButton").click();
  await page.locator("#weeklyRunRecognition").click();
  await expect(page.locator("#weeklyRecognitionStatus")).toContainText("既存のカードは変更されていません");
  const savedAfterFailure = await page.evaluate((key) => localStorage.getItem(key), CARD_STORAGE_KEY);
  expect(savedAfterFailure).toBe(savedBeforeReload);
});

test("@published 公開版に週間AI読み取り画面が反映されている", async ({ page }) => {
  test.setTimeout(process.env.PLAYWRIGHT_BASE_URL ? 180_000 : 30_000);
  await gotoHome(page);
  await openWeeklyFromHome(page);
  await expect(page.locator("#weeklyRecognitionButton")).toBeVisible();
  await expect(page.locator("#weeklyCardShelf")).toBeVisible();
  await page.locator("#weeklyRecognitionButton").click();
  await expect(page.locator("#weeklyRecognitionDialog")).toHaveAttribute("open", "");
  await expect(page.locator("#weeklyRunRecognition")).toBeVisible();
  await expect(page.locator("#weeklySaveCandidates")).toBeVisible();
});
