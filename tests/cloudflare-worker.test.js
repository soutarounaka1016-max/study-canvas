import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest, parseAiJson } from "../cloudflare-worker.js";

const origin = "https://soutarounaka1016-max.github.io";
const image = { mimeType: "image/png", data: Buffer.from("fake").toString("base64") };

function request(path, body, method = "POST") {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

test("Workers AIから複数タスクを返す", async () => {
  let model;
  let input;
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: { async run(nextModel, nextInput) { model = nextModel; input = nextInput; return { response: { tasks: [
      { title: "微積5問", confidence: 0.9, warning: "" },
      { title: "ベクトル復習", confidence: 0.7, warning: "" },
    ] } }; } },
  };
  const response = await handleRequest(request("/recognize", { mode: "weekly", subject: "数学", weekStart: "2026-07-27", image }), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.tasks.length, 2);
  assert.match(model, /gemma-4-26b-a4b/);
  assert.match(input.prompt, /数学/);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
});

test("許可されていない公開元を拒否する", async () => {
  const req = new Request("https://worker.example/recognize", { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ mode: "weekly", subject: "数学", weekStart: "2026-07-27", image }) });
  const response = await handleRequest(req, { ALLOWED_ORIGIN: origin, AI: { run: async () => ({}) } });
  assert.equal(response.status, 403);
});

test("AIエラー時に保存処理を持たずエラーだけ返す", async () => {
  const env = { ALLOWED_ORIGIN: origin, AI: { async run() { throw new Error("temporary capacity error"); } } };
  const response = await handleRequest(request("/recognize", { mode: "weekly", subject: "数学", weekStart: "2026-07-27", image }), env);
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, "FREE_TIER_LIMIT");
});

test("文字列JSONも解析できる", () => {
  assert.deepEqual(parseAiJson({ response: '```json\n{"tasks":[]}\n```' }), { tasks: [] });
});
