import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWeeklyRecognitionTasks, recognizeWeeklyCanvas } from "../src/weekly-recognition.js";

const imageDataUrl = `data:image/png;base64,${Buffer.from("fake-image").toString("base64")}`;
const baseOptions = { imageDataUrl, subject: "数学", weekStart: "2026-07-27" };

test("複数の読み取り候補を返す", async () => {
  let requestBody;
  const fetchImpl = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ tasks: [
      { title: "青チャート 120〜130", confidence: 0.91, warning: "" },
      { title: "ベクトルの復習", confidence: 0.72, warning: "数字なし" },
    ] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const result = await recognizeWeeklyCanvas({ fetchImpl, ...baseOptions });
  assert.equal(result.length, 2);
  assert.equal(requestBody.mode, "weekly");
  assert.equal(requestBody.subject, "数学");
  assert.equal(requestBody.weekStart, "2026-07-27");
});

test("空候補を除外し、科目を固定する", () => {
  const result = normalizeWeeklyRecognitionTasks([
    { title: "  英文解釈 70〜75  ", confidence: 2, warning: "" },
    { title: "", confidence: 1, warning: "" },
  ], "英語");
  assert.deepEqual(result, [{ subject: "英語", title: "英文解釈 70〜75", confidence: 1, warning: "" }]);
});

test("一時的な502後に一度だけ再試行して成功する", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: { code: "AI_REQUEST_FAILED" } }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ tasks: [
      { title: "微積分 3問", confidence: 0.9, warning: "" },
    ] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const result = await recognizeWeeklyCanvas({ fetchImpl, ...baseOptions });
  assert.equal(calls, 2);
  assert.equal(result[0].title, "微積分 3問");
});

test("429は再試行せず無料枠メッセージを返す", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { code: "FREE_TIER_LIMIT" } }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  };
  await assert.rejects(() => recognizeWeeklyCanvas({ fetchImpl, ...baseOptions }), /無料枠/);
  assert.equal(calls, 1);
});

test("AI失敗後も既存データを変更しないメッセージへ変換する", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: { code: "INVALID_AI_RESULT" } }), {
    status: 422,
    headers: { "Content-Type": "application/json" },
  });
  await assert.rejects(() => recognizeWeeklyCanvas({ fetchImpl, ...baseOptions }), /既存のカードは変更されていません/);
});
