const WORKERS_AI_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const MAX_IMAGE_BYTES = 1_250_000;
const MAX_REQUEST_BYTES = 1_800_000;
const WEEKLY_SUBJECTS = ["数学", "英語", "物理", "化学", "その他"];
const SINGLE_SUBJECTS = [...WEEKLY_SUBJECTS, "国語"];
const FALLBACK_WARNING = "AIの返却形式を補正したため、内容を確認してください";

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};

export async function handleRequest(request, env) {
  const origin = request.headers.get("Origin") || "";
  const cors = corsHeaders(origin, env?.ALLOWED_ORIGIN);
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    if (!isAllowedOrigin(origin, env?.ALLOWED_ORIGIN)) {
      return jsonError(403, "ORIGIN_DENIED", "許可されていない公開元です", cors);
    }
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method === "GET" && url.pathname === "/health") {
    if (!env?.AI || !env?.ALLOWED_ORIGIN) {
      return jsonError(503, "NOT_CONFIGURED", "Workers AIバインディングが設定されていません", cors);
    }
    return json({ ok: true, model: WORKERS_AI_MODEL, noPaidFallback: true }, 200, cors);
  }

  if (!env?.AI || !env?.ALLOWED_ORIGIN) {
    return jsonError(503, "NOT_CONFIGURED", "Workers AIバインディングが設定されていません", cors);
  }
  if (!isAllowedOrigin(origin, env.ALLOWED_ORIGIN)) {
    return jsonError(403, "ORIGIN_DENIED", "許可されていない公開元です", cors);
  }
  if (request.method !== "POST" || url.pathname !== "/recognize") {
    return jsonError(404, "NOT_FOUND", "見つかりません", cors);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonError(413, "IMAGE_TOO_LARGE", "画像が大きすぎます", cors);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "JSONを読み取れません", cors);
  }

  const image = validateImage(payload?.image);
  if (!image.ok) return jsonError(image.status, image.code, image.message, cors);

  const mode = payload?.mode === "weekly" ? "weekly" : "single";
  let subject;
  let weekStart;
  try {
    if (mode === "weekly") {
      subject = validateWeeklySubject(payload?.subject);
      weekStart = validateWeekStart(payload?.weekStart);
    }
  } catch (error) {
    return jsonError(400, "INVALID_REQUEST", safeErrorMessage(error) || "入力が正しくありません", cors);
  }

  let result;
  try {
    const input = mode === "weekly"
      ? createWeeklyRequest(image.value, subject)
      : createSingleRequest(image.value);
    result = await env.AI.run(WORKERS_AI_MODEL, input);
  } catch (error) {
    const message = safeErrorMessage(error);
    if (/429|quota|limit|neuron|capacity/i.test(message)) {
      return jsonError(429, "FREE_TIER_LIMIT", "Workers AIの無料枠または利用上限に達しました", cors);
    }
    return jsonError(502, "AI_REQUEST_FAILED", message || "Workers AIへ接続できません", cors);
  }

  try {
    if (mode === "weekly") {
      const tasks = parseWeeklyTasksFromResult(result, subject);
      return json({ tasks, subject, weekStart, model: WORKERS_AI_MODEL }, 200, cors);
    }
    const candidate = normalizeSingleCandidate(parseAiJson(result));
    return json({ candidate, model: WORKERS_AI_MODEL }, 200, cors);
  } catch (error) {
    return jsonError(
      422,
      "INVALID_AI_RESULT",
      safeErrorMessage(error) || "AIの読み取り結果が正しくありません",
      cors,
      { diagnostic: describeAiShape(result) },
    );
  }
}

export function createWeeklyRequest(image, subject) {
  const prompt = [
    `画像は高校生が手書きした${subject}の週間目標です。`,
    "画像内に実際に書かれている内容だけを、1行または1項目につき1件の勉強タスクとして抽出してください。",
    "参考書名、ページ番号、問題数、単元名を可能な限りそのまま残してください。",
    "予定時間や画像にない内容は推測しないでください。空白や罫線は無視してください。",
    "読めない部分はwarningへ短く書き、titleへ勝手な補完をしすぎないでください。",
    "日本語で返してください。JSON Schemaが利用できない場合も、タスクだけを1行に1件ずつ返してください。",
  ].join("\n");
  return {
    messages: [
      {
        role: "system",
        content: "画像内の文字を正確に読み取り、指定されたJSON Schemaに従って返してください。説明文やMarkdownは不要です。",
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } },
        ],
      },
    ],
    image: image.data,
    max_completion_tokens: 1800,
    temperature: 0.1,
    response_format: {
      type: "json_schema",
      json_schema: weeklyTaskSchema(),
    },
  };
}

export function createSingleRequest(image) {
  const prompt = "画像は高校生の受験勉強メモです。画像内の手書きだけを読み、実行可能な勉強タスク1件へ整理してください。科目は数学、英語、物理、化学、国語、その他のいずれかです。予定時間が書かれていない場合は30分としてください。日本語で返してください。";
  return {
    messages: [
      {
        role: "system",
        content: "画像内の文字を正確に読み取り、指定されたJSON Schemaに従って返してください。説明文やMarkdownは不要です。",
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } },
        ],
      },
    ],
    image: image.data,
    max_completion_tokens: 900,
    temperature: 0.1,
    response_format: {
      type: "json_schema",
      json_schema: {
        type: "object",
        properties: {
          subject: { type: "string", enum: SINGLE_SUBJECTS },
          title: { type: "string", maxLength: 120 },
          minutes: { type: "integer", minimum: 5, maximum: 600 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          warning: { type: "string", maxLength: 160 },
        },
        required: ["subject", "title", "minutes", "confidence", "warning"],
        additionalProperties: false,
      },
    },
  };
}

function weeklyTaskSchema() {
  return {
    type: "object",
    properties: {
      tasks: {
        type: "array",
        maxItems: 16,
        items: {
          type: "object",
          properties: {
            title: { type: "string", maxLength: 120 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            warning: { type: "string", maxLength: 160 },
          },
          required: ["title", "confidence", "warning"],
          additionalProperties: false,
        },
      },
    },
    required: ["tasks"],
    additionalProperties: false,
  };
}

export function parseWeeklyTasksFromResult(result, subject) {
  try {
    return normalizeWeeklyTasks(parseAiJson(result)?.tasks, subject);
  } catch (jsonError) {
    const texts = collectFinalTexts(result);
    for (const text of texts) {
      const tasks = parseWeeklyText(text);
      if (tasks.length > 0) return tasks;
    }
    throw jsonError;
  }
}

export function parseAiJson(result) {
  const parsed = findStructuredJson(result, 0, new Set());
  if (parsed) return parsed;
  throw new Error("AIからJSONが返りませんでした");
}

function findStructuredJson(value, depth, visited) {
  if (depth > 8 || value === null || value === undefined) return null;
  if (typeof value === "string") return parseJsonText(value);
  if (typeof value !== "object") return null;
  if (visited.has(value)) return null;
  visited.add(value);

  if (!Array.isArray(value) && (Array.isArray(value.tasks) || typeof value.title === "string")) {
    return value;
  }

  const priorityKeys = [
    "response", "description", "output_text", "output", "content", "text",
    "message", "choices", "result", "data", "reasoning_content", "reasoning",
  ];
  if (!Array.isArray(value)) {
    for (const key of priorityKeys) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      const found = findStructuredJson(value[key], depth + 1, visited);
      if (found) return found;
    }
  }

  const entries = Array.isArray(value) ? value : Object.values(value);
  for (const entry of entries) {
    const found = findStructuredJson(entry, depth + 1, visited);
    if (found) return found;
  }
  return null;
}

function parseJsonText(text) {
  const withoutThinking = String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const firstBrace = withoutThinking.indexOf("{");
  const lastBrace = withoutThinking.lastIndexOf("}");
  const candidate = firstBrace >= 0 && lastBrace > firstBrace
    ? withoutThinking.slice(firstBrace, lastBrace + 1)
    : withoutThinking;
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function collectFinalTexts(result) {
  const values = [
    result?.response,
    result?.description,
    result?.output_text,
    result?.output,
    result?.choices?.[0]?.message?.content,
    result?.choices?.[0]?.text,
    result?.result?.response,
    result?.result?.description,
    result?.result?.output_text,
  ];
  const texts = [];
  for (const value of values) appendText(value, texts);
  return [...new Set(texts.map((text) => text.trim()).filter(Boolean))];
}

function appendText(value, texts) {
  if (typeof value === "string") {
    texts.push(value);
    return;
  }
  if (!Array.isArray(value)) return;
  for (const part of value) {
    if (typeof part === "string") texts.push(part);
    else if (typeof part?.text === "string") texts.push(part.text);
    else if (typeof part?.content === "string") texts.push(part.content);
  }
}

export function parseWeeklyText(text) {
  const cleaned = String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  if (!cleaned) return [];

  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^\s*(?:[-*•・]|\d+[.)]|TASK\s*[:：]|title\s*[:：])\s*/i, "")
      .replace(/^\s*["'「『]|["'」』]\s*$/g, "")
      .trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^(?:以下|読み取り結果|結果|タスク一覧|tasks?|json|warning|confidence)\s*[:：]?$/i.test(line));

  const candidates = lines.length > 0 ? lines : [cleaned];
  const seen = new Set();
  const tasks = [];
  for (const candidate of candidates) {
    const title = candidate.replace(/\s+/g, " ").slice(0, 120).trim();
    if (!title || seen.has(title) || /^[{}\[\],]+$/.test(title)) continue;
    seen.add(title);
    tasks.push({ title, confidence: 0.5, warning: FALLBACK_WARNING });
    if (tasks.length >= 16) break;
  }
  return tasks;
}

export function normalizeWeeklyTasks(value, subject) {
  validateWeeklySubject(subject);
  if (!Array.isArray(value)) throw new Error("AIのタスク一覧が正しくありません");
  const tasks = [];
  for (const item of value.slice(0, 16)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const title = typeof item.title === "string" ? item.title.trim().replace(/\s+/g, " ").slice(0, 120) : "";
    if (!title) continue;
    const confidence = Number(item.confidence);
    tasks.push({
      title,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
      warning: typeof item.warning === "string" ? item.warning.trim().replace(/\s+/g, " ").slice(0, 160) : "",
    });
  }
  if (tasks.length === 0) throw new Error("手書きからタスクを読み取れませんでした");
  return tasks;
}

export function normalizeSingleCandidate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AIの候補形式が正しくありません");
  const subject = SINGLE_SUBJECTS.includes(value.subject) ? value.subject : "その他";
  const title = typeof value.title === "string" ? value.title.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  if (!title) throw new Error("勉強内容を読み取れませんでした");
  const minutes = Number(value.minutes);
  const confidence = Number(value.confidence);
  return {
    subject,
    title,
    minutes: Number.isFinite(minutes) ? Math.min(600, Math.max(5, Math.round(minutes / 5) * 5)) : 30,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    warning: typeof value.warning === "string" ? value.warning.trim().replace(/\s+/g, " ").slice(0, 160) : "",
  };
}

export function describeAiShape(value, depth = 0) {
  if (value === null) return { type: "null" };
  if (value === undefined) return { type: "undefined" };
  if (typeof value === "string") return { type: "string", length: value.length };
  if (typeof value !== "object") return { type: typeof value };
  if (depth >= 3) return { type: Array.isArray(value) ? "array" : "object" };
  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      first: value.length > 0 ? describeAiShape(value[0], depth + 1) : undefined,
    };
  }
  const keys = Object.keys(value).slice(0, 24);
  const fields = {};
  for (const key of keys) fields[key] = describeAiShape(value[key], depth + 1);
  return { type: "object", keys, fields };
}

function validateImage(image) {
  if (!image || typeof image !== "object" || Array.isArray(image)) return invalid(400, "INVALID_IMAGE", "画像がありません");
  if (!["image/png", "image/jpeg"].includes(image.mimeType)) return invalid(400, "INVALID_IMAGE_TYPE", "画像形式が正しくありません");
  if (typeof image.data !== "string" || !/^[A-Za-z0-9+/=]+$/.test(image.data)) return invalid(400, "INVALID_IMAGE", "画像データが正しくありません");
  const estimatedBytes = Math.floor(image.data.length * 3 / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) return invalid(413, "IMAGE_TOO_LARGE", "画像が大きすぎます");
  return { ok: true, value: { mimeType: image.mimeType, data: image.data } };
}

function validateWeeklySubject(subject) {
  if (!WEEKLY_SUBJECTS.includes(subject)) throw new Error("科目が正しくありません");
  return subject;
}

function validateWeekStart(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("週の開始日が正しくありません");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || date.getUTCDay() !== 1) {
    throw new Error("週の開始日が正しくありません");
  }
  return value;
}

function invalid(status, code, message) {
  return { ok: false, status, code, message };
}

function isAllowedOrigin(origin, allowedOrigin) {
  if (!origin || !allowedOrigin) return false;
  try {
    return new URL(origin).origin === new URL(allowedOrigin).origin;
  } catch {
    return false;
  }
}

function corsHeaders(origin, allowedOrigin) {
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
  if (isAllowedOrigin(origin, allowedOrigin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function safeErrorMessage(error) {
  return typeof error?.message === "string" ? error.message.trim().slice(0, 180) : "";
}

function json(value, status, headers) {
  return new Response(JSON.stringify(value), { status, headers });
}

function jsonError(status, code, message, headers, extra = {}) {
  return json({ error: { code, message, ...extra } }, status, headers);
}
