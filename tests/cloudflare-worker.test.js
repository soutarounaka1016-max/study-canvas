import test from "node:test";
import assert from "node:assert/strict";
import {
  createGemmaWeeklyRequest,
  createWeeklyRequest,
  handleRequest,
  parseAiJson,
  parseWeeklyTasksFromResult,
  parseWeeklyText,
} from "../cloudflare-worker.js";

const origin = "https://soutarounaka1016-max.github.io";
const image = { mimeType: "image/png", data: Buffer.from("sample-image").toString("base64") };
const primaryModel = "@cf/moondream/moondream3.1-9B-A2B";
const fallbackModel = "@cf/google/gemma-4-26b-a4b-it";

function request(path, body, method = "POST") {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function weeklyBody() {
  return { mode: "weekly", subject: "数学", weekStart: "2026-07-27", image };
}

test("Moondreamへ公式のquery入力を送る", () => {
  const input = createWeeklyRequest(image, "数学");
  assert.equal(input.task, "query");
  assert.equal(input.image, `data:image/png;base64,${image.data}`);
  assert.match(input.question, /数学/);
  assert.match(input.question, /予定時間、優先順位/);
  assert.equal(input.reasoning, false);
  assert.equal(input.stream, false);
  assert.equal(input.temperature, 0);
});

test("Moondream主系から複数タスクを返す", async () => {
  const calls = [];
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: {
      async run(model, input) {
        calls.push({ model, input });
        return { answer: '{"tasks":[{"title":"微積5問","confidence":0.9,"warning":""},{"title":"ベクトル復習","confidence":0.7,"warning":""}]}' };
      },
    },
  };
  const response = await handleRequest(request("/recognize", weeklyBody()), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.tasks.length, 2);
  assert.equal(payload.model, primaryModel);
  assert.equal(payload.fallbackUsed, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, primaryModel);
  assert.equal(calls[0].input.task, "query");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
});

test("Moondream結果が使えない場合だけGemma補助へ切り替える", async () => {
  const calls = [];
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: {
      async run(model, input) {
        calls.push({ model, input });
        if (model === primaryModel) return { answer: "" };
        return { response: { tasks: [{ title: "積分3問", confidence: 0.8, warning: "" }] } };
      },
    },
  };
  const response = await handleRequest(request("/recognize", weeklyBody()), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.model, fallbackModel);
  assert.equal(payload.fallbackUsed, true);
  assert.equal(payload.tasks[0].title, "積分3問");
  assert.deepEqual(calls.map((call) => call.model), [primaryModel, fallbackModel]);
  assert.equal(calls[1].input.response_format.type, "json_schema");
});

test("Gemma補助は画像とJSON Schemaを含む", () => {
  const input = createGemmaWeeklyRequest(image, "数学");
  assert.equal(input.image, image.data);
  assert.equal(input.messages[1].content[1].type, "image_url");
  assert.equal(input.response_format.type, "json_schema");
});

test("healthは主系、補助、最大待ち時間を返す", async () => {
  const response = await handleRequest(request("/health", undefined, "GET"), {
    ALLOWED_ORIGIN: origin,
    AI: { run: async () => ({}) },
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.model, primaryModel);
  assert.equal(payload.primaryModel, primaryModel);
  assert.equal(payload.fallbackModel, fallbackModel);
  assert.equal(payload.maxRecognitionMs, 28_000);
  assert.equal(payload.noPaidFallback, true);
});

test("許可されていない公開元を拒否する", async () => {
  const req = new Request("https://worker.example/recognize", {
    method: "POST",
    headers: { Origin: "https://not-allowed.example", "Content-Type": "application/json" },
    body: JSON.stringify(weeklyBody()),
  });
  const response = await handleRequest(req, { ALLOWED_ORIGIN: origin, AI: { run: async () => ({}) } });
  assert.equal(response.status, 403);
});

test("AI利用上限時は429を返し補助へ無駄な再送をしない", async () => {
  let calls = 0;
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: { async run() { calls += 1; throw new Error("429 neuron limit"); } },
  };
  const response = await handleRequest(request("/recognize", weeklyBody()), env);
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, "FREE_TIER_LIMIT");
  assert.equal(calls, 1);
});

test("両モデルが候補を返せない場合も既存データ不変の422を返す", async () => {
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: { async run() { return { answer: "" }; } },
  };
  const response = await handleRequest(request("/recognize", weeklyBody()), env);
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.error.code, "INVALID_AI_RESULT");
  assert.match(payload.error.message, /既存のカードは変更されていません/);
});

test("Moondreamのanswer内JSONを解析できる", () => {
  assert.deepEqual(parseAiJson({ answer: '```json\n{"tasks":[]}\n```' }), { tasks: [] });
});

test("OpenAI互換choicesのJSONを解析できる", () => {
  assert.deepEqual(parseAiJson({
    choices: [{ message: { content: '回答:\n{"tasks":[{"title":"英文1題"}]}' } }],
  }), { tasks: [{ title: "英文1題" }] });
});

test("JSONでない箇条書きを週間候補へ補正する", () => {
  assert.deepEqual(parseWeeklyText("- 積分 3問\n- ベクトル復習"), [
    { title: "積分 3問", confidence: 0.5, warning: "AIの返却形式を補正したため、内容を確認してください" },
    { title: "ベクトル復習", confidence: 0.5, warning: "AIの返却形式を補正したため、内容を確認してください" },
  ]);
  assert.equal(parseWeeklyTasksFromResult({ answer: "1. 積分 3問\n2. ベクトル復習" }, "数学").length, 2);
});
