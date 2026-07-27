import test from "node:test";
import assert from "node:assert/strict";
import { createWeeklyRequest, handleRequest, parseAiJson } from "../cloudflare-worker.js";

const origin = "https://soutarounaka1016-max.github.io";
const image = { mimeType: "image/png", data: Buffer.from("sample-image").toString("base64") };

function request(path, body, method = "POST") {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

test("Gemmaへmessagesとbase64画像を送る", () => {
  const input = createWeeklyRequest(image, "数学");
  assert.equal(input.image, image.data);
  assert.doesNotMatch(input.image, /^data:/);
  assert.equal(input.messages[0].role, "system");
  assert.match(input.messages[1].content, /数学/);
  assert.equal(input.response_format.type, "json_schema");
});

test("Workers AIから複数タスクを返す", async () => {
  let model;
  let input;
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: {
      async run(nextModel, nextInput) {
        model = nextModel;
        input = nextInput;
        return { response: { tasks: [
          { title: "微積5問", confidence: 0.9, warning: "" },
          { title: "ベクトル復習", confidence: 0.7, warning: "" },
        ] } };
      },
    },
  };
  const response = await handleRequest(request("/recognize", {
    mode: "weekly", subject: "数学", weekStart: "2026-07-27", image,
  }), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.tasks.length, 2);
  assert.match(model, /gemma-4-26b-a4b/);
  assert.equal(input.image, image.data);
  assert.match(input.messages[1].content, /数学/);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
});

test("許可されていない公開元を拒否する", async () => {
  const req = new Request("https://worker.example/recognize", {
    method: "POST",
    headers: { Origin: "https://not-allowed.example", "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "weekly", subject: "数学", weekStart: "2026-07-27", image }),
  });
  const response = await handleRequest(req, { ALLOWED_ORIGIN: origin, AI: { run: async () => ({}) } });
  assert.equal(response.status, 403);
});

test("AI利用上限時は429を返す", async () => {
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: { async run() { throw new Error("temporary capacity limit"); } },
  };
  const response = await handleRequest(request("/recognize", {
    mode: "weekly", subject: "数学", weekStart: "2026-07-27", image,
  }), env);
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, "FREE_TIER_LIMIT");
});

test("不正なAI結果は422を返す", async () => {
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: { async run() { return { response: "読み取り結果なし" }; } },
  };
  const response = await handleRequest(request("/recognize", {
    mode: "weekly", subject: "数学", weekStart: "2026-07-27", image,
  }), env);
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.error.code, "INVALID_AI_RESULT");
});

test("responseの文字列JSONを解析できる", () => {
  assert.deepEqual(parseAiJson({ response: '```json\n{"tasks":[]}\n```' }), { tasks: [] });
});

test("descriptionのJSONを解析できる", () => {
  assert.deepEqual(parseAiJson({ description: '{"tasks":[{"title":"積分3問"}]}' }), {
    tasks: [{ title: "積分3問" }],
  });
});

test("OpenAI互換choicesのJSONを解析できる", () => {
  assert.deepEqual(parseAiJson({
    choices: [{ message: { content: '回答:\n{"tasks":[{"title":"英文1題"}]}' } }],
  }), { tasks: [{ title: "英文1題" }] });
});

test("content配列内のJSONを解析できる", () => {
  assert.deepEqual(parseAiJson({
    choices: [{ message: { content: [{ type: "text", text: '{"tasks":[]}' }] } }],
  }), { tasks: [] });
});
