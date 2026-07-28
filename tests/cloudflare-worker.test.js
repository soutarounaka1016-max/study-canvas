import test from "node:test";
import assert from "node:assert/strict";
import {
  createMistralWeeklyRequest,
  createWeeklyRequest,
  filterGroundedWeeklyTasks,
  handleRequest,
  hasRecognitionSupport,
  parseAiJson,
  parseWeeklyTasksFromResult,
  parseWeeklyText,
} from "../cloudflare-worker.js";

const origin = "https://soutarounaka1016-max.github.io";
const image = { mimeType: "image/png", data: Buffer.from("sample-image").toString("base64") };
const primaryModel = "@cf/moondream/moondream3.1-9B-A2B";
const fallbackModel = "@cf/mistralai/mistral-small-3.1-24b-instruct";

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

test("Moondreamへ短いOCR query入力を送る", () => {
  const input = createWeeklyRequest(image, "数学");
  assert.equal(input.task, "query");
  assert.equal(input.image, `data:image/png;base64,${image.data}`);
  assert.match(input.question, /Copy every visible line/);
  assert.match(input.question, /original language/);
  assert.doesNotMatch(input.question, /JSON/);
  assert.equal(input.reasoning, false);
  assert.equal(input.stream, false);
  assert.equal(input.temperature, 0);
});

test("MoondreamのプレーンOCRから複数タスクを返す", async () => {
  const calls = [];
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: {
      async run(model, input) {
        calls.push({ model, input });
        return { answer: "MATH WEEKLY PLAN\nINTEGRAL 3 QUESTIONS\nVECTOR REVIEW" };
      },
    },
  };
  const response = await handleRequest(request("/recognize", weeklyBody()), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(payload.tasks.map((task) => task.title), ["INTEGRAL 3 QUESTIONS", "VECTOR REVIEW"]);
  assert.equal(payload.model, primaryModel);
  assert.equal(payload.fallbackUsed, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, primaryModel);
  assert.equal(calls[0].input.task, "query");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
});

test("Moondreamの日本語OCRから見出しを除いて候補化する", () => {
  assert.deepEqual(parseWeeklyText("数学 週間目標\n微積分 3問\nチョイス A").map((task) => task.title), [
    "微積分 3問",
    "チョイス A",
  ]);
});

test("日本語を含むMoondream OCRは画像だけを読むMistralとの一致候補に絞る", async () => {
  const calls = [];
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: {
      async run(model, input) {
        calls.push({ model, input });
        if (model === primaryModel) {
          return { answer: "数学通間月滑\n減林分3間\nCHOIS A" };
        }
        return { response: { tasks: [
          { title: "微積分 3問", confidence: 0.95, warning: "" },
          { title: "チョイス A", confidence: 0.92, warning: "" },
        ] } };
      },
    },
  };

  const response = await handleRequest(request("/recognize", weeklyBody()), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.model, fallbackModel);
  assert.equal(payload.fallbackUsed, true);
  assert.deepEqual(payload.tasks.map((task) => task.title), ["微積分 3問", "チョイス A"]);
  assert.deepEqual(calls.map((call) => call.model), [primaryModel, fallbackModel]);
  const refinementPrompt = calls[1].input.messages[1].content[0].text;
  assert.doesNotMatch(refinementPrompt, /高速OCR結果|減林分3間|ocr_hint/);
  assert.match(refinementPrompt, /画像だけを根拠/);
});

test("Moondreamが指示文を復唱した場合は候補として採用しない", async () => {
  const calls = [];
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: {
      async run(model, input) {
        calls.push({ model, input });
        if (model === primaryModel) {
          return { answer: "読み取った内容\n1行または1項目を1件の勉強タスクにしてください\n返答はMarkdownを使わず、次のJSONだけにしてください" };
        }
        return { response: { tasks: [{ title: "積分3問", confidence: 0.8, warning: "" }] } };
      },
    },
  };
  const response = await handleRequest(request("/recognize", weeklyBody()), env);
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.error.code, "INVALID_AI_RESULT");
  assert.match(payload.error.message, /既存のカードは変更されていません/);
  assert.deepEqual(calls.map((call) => call.model), [primaryModel, fallbackModel]);
});

test("Moondream結果が空の場合はMistral単独候補を採用しない", async () => {
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
  assert.equal(response.status, 422);
  assert.equal(payload.error.code, "INVALID_AI_RESULT");
  assert.match(payload.error.message, /既存のカードは変更されていません/);
  assert.deepEqual(calls.map((call) => call.model), [primaryModel, fallbackModel]);
  assert.equal(calls[1].input.response_format, undefined);
  assert.equal(calls[1].input.temperature, 0);
});

test("Mistral補助は一次OCRを渡さずbase64画像だけで短い行単位OCRを行う", () => {
  const input = createMistralWeeklyRequest(image, "数学");
  assert.equal(input.image, undefined);
  assert.doesNotMatch(input.messages[1].content[0].text, /ocr_hint|高速OCR結果/);
  assert.equal(input.messages[1].content[1].type, "image_url");
  assert.equal(input.messages[1].content[1].image_url.url, `data:image/png;base64,${image.data}`);
  assert.match(input.messages[0].content, /画像OCR/);
  assert.match(input.messages[1].content[0].text, /1件につき1行/);
  assert.equal(input.response_format, undefined);
  assert.equal(input.max_tokens, 320);
  assert.equal(input.temperature, 0);
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
  assert.equal(payload.workerRevision, "20260728-ocr-grounding-1");
  assert.equal(payload.maxRecognitionMs, 32_000);
  assert.equal(payload.noPaidFallback, true);
});

test("日本語補正が時間切れの場合は一次候補を表示しない", async () => {
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: {
      async run(model) {
        if (model === primaryModel) return { answer: "数学 週間目標\n微積分 3問\nチョイス A" };
        const error = new Error("FALLBACK_TIMEOUT");
        error.code = "FALLBACK_TIMEOUT";
        throw error;
      },
    },
  };
  const response = await handleRequest(request("/recognize", weeklyBody()), env);
  const payload = await response.json();
  assert.equal(response.status, 504);
  assert.equal(payload.error.code, "AI_TIMEOUT");
  assert.match(payload.error.message, /既存のカードは変更されていません/);
});

test("二つのOCRに文字上の根拠がある補正候補だけを採用する", () => {
  const primaryTasks = [
    { title: "減林分3間" },
    { title: "CHOIS A" },
  ];
  const refinedTasks = [
    { title: "微積分 3問", confidence: 0.5, warning: "" },
    { title: "チョイス A", confidence: 0.5, warning: "" },
    { title: "第2章の問題", confidence: 0.5, warning: "" },
  ];
  assert.equal(hasRecognitionSupport("減林分3間", "微積分 3問"), true);
  assert.equal(hasRecognitionSupport("CHOIS A", "チョイス A"), true);
  assert.equal(hasRecognitionSupport("英問", "第2章の問題"), false);
  assert.deepEqual(
    filterGroundedWeeklyTasks(primaryTasks, refinedTasks).map((task) => task.title),
    ["微積分 3問", "チョイス A"],
  );
});

test("手書きと無関係な候補が二つ返っても表示せず422にする", async () => {
  const env = {
    ALLOWED_ORIGIN: origin,
    AI: {
      async run(model) {
        if (model === primaryModel) return { answer: "英問" };
        return { answer: "27日の課題\n第2章の問題" };
      },
    },
  };
  const response = await handleRequest(request("/recognize", weeklyBody()), env);
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.error.code, "INVALID_AI_RESULT");
  assert.match(payload.error.message, /既存のカードは変更されていません/);
  assert.equal(payload.tasks, undefined);
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

test("Moondreamのanswer内JSONも後方互換で解析できる", () => {
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

test("壊れたJSON断片をタスク候補として採用しない", () => {
  assert.deepEqual(parseWeeklyText([
    '{"tasks": [',
    '{"confidence": 1.0, "title": "青チャート 数I・A 二次関数 p.12',
    '"warning": ""}',
    "]",
  ].join("\n")), []);
});
