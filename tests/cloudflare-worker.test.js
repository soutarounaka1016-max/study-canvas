import test from "node:test";
import assert from "node:assert/strict";
import {
  createWeeklyRequest,
  handleRequest,
  parseAiJson,
  parseWeeklyTasksFromResult,
  parseWeeklyText,
} from "../cloudflare-worker.js";

const origin = "https://soutarounaka1016-max.github.io";
const image = { mimeType: "image/png", data: Buffer.from("sample-image").toString("base64") };

function request(path, body, method = "POST") {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function userText(input) {
  return input.messages[1].content.find((part) => part.type === "text")?.text || "";
}

test("Gemmaへmessages、image_url、base64画像を送る", () => {
  const input = createWeeklyRequest(image, "数学");
  assert.equal(input.image, image.data);
  assert.doesNotMatch(input.image, /^data:/);
  assert.equal(input.messages[0].role, "system");
  assert.match(userText(input), /数学/);
  const imagePart = input.messages[1].content.find((part) => part.type === "image_url");
  assert.equal(imagePart.image_url.url, `data:image/png;base64,${image.data}`);
  assert.equal(input.response_format.type, "json_schema");
  assert.equal(input.max_completion_tokens, 1800);
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
  assert.match(userText(input), /数学/);
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

test("空のAI結果は診断情報付き422を返す", async () => {
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: { async run() { return { choices: [{ message: { content: "" } }] }; } },
  };
  const response = await handleRequest(request("/recognize", {
    mode: "weekly", subject: "数学", weekStart: "2026-07-27", image,
  }), env);
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.error.code, "INVALID_AI_RESULT");
  assert.equal(payload.error.diagnostic.type, "object");
  assert.ok(payload.error.diagnostic.keys.includes("choices"));
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

test("推論欄の深いJSONも解析できる", () => {
  assert.deepEqual(parseAiJson({
    choices: [{ message: { content: "", reasoning_content: '検討\n{"tasks":[{"title":"物理2問"}]}' } }],
  }), { tasks: [{ title: "物理2問" }] });
});

test("content配列内のJSONを解析できる", () => {
  assert.deepEqual(parseAiJson({
    choices: [{ message: { content: [{ type: "text", text: '{"tasks":[]}' }] } }],
  }), { tasks: [] });
});

test("JSONでない箇条書きを週間候補へ補正する", () => {
  assert.deepEqual(parseWeeklyText("- 積分 3問\n- ベクトル復習"), [
    { title: "積分 3問", confidence: 0.5, warning: "AIの返却形式を補正したため、内容を確認してください" },
    { title: "ベクトル復習", confidence: 0.5, warning: "AIの返却形式を補正したため、内容を確認してください" },
  ]);
  assert.equal(parseWeeklyTasksFromResult({
    choices: [{ message: { content: "1. 積分 3問\n2. ベクトル復習" } }],
  }, "数学").length, 2);
});
