import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest, parseAiTasks } from "../cloudflare-worker.js";

const origin = "https://soutarounaka1016-max.github.io";

function request(body, path = "/recognize") {
  return new Request(`https://worker.example${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

function validPayload() {
  return {
    subject: "数学",
    weekStart: "2026-07-27",
    image: { mimeType: "image/png", data: "aGVsbG8=" },
  };
}

test("Workers AIの複数タスクを正規化して返す", async () => {
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: {
      async run(model, input) {
        assert.equal(model, "@cf/google/gemma-4-26b-a4b-it");
        assert.match(input.image, /^data:image\/png;base64,/);
        return { response: '{"tasks":[{"text":" 1対1対応を5問 ","confidence":0.91},{"text":"ベクトルを復習","confidence":0.7}]}' };
      },
    },
  };
  const response = await handleRequest(request(validPayload()), env);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.tasks.map((task) => task.text), ["1対1対応を5問", "ベクトルを復習"]);
  assert.equal(payload.subject, "数学");
  assert.equal(payload.noPaidFallback, true);
});

test("AI失敗時は明示的なエラーを返す", async () => {
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: { async run() { throw new Error("temporary failure"); } },
  };
  const response = await handleRequest(request(validPayload()), env);
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.equal(payload.error.code, "AI_REQUEST_FAILED");
});

test("許可されていないOriginと不正画像を拒否する", async () => {
  const denied = new Request("https://worker.example/recognize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify(validPayload()),
  });
  const env = { ALLOWED_ORIGIN: origin, AI: { run() {} } };
  assert.equal((await handleRequest(denied, env)).status, 403);
  assert.equal((await handleRequest(request({ ...validPayload(), image: { mimeType: "text/plain", data: "aA==" } }), env)).status, 400);
});

test("コードフェンスを含むJSONも読み取れる", () => {
  const tasks = parseAiTasks({ response: '```json\n{"tasks":[{"text":"英文解釈70〜75","confidence":1.2}]}\n```' });
  assert.deepEqual(tasks, [{ text: "英文解釈70〜75", confidence: 1 }]);
});
