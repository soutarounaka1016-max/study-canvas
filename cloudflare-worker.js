const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const SUBJECTS = ["数学", "英語", "物理", "化学", "その他"];
const MAX_IMAGE_BYTES = 1_500_000;
const MAX_REQUEST_BYTES = 2_100_000;
const MAX_TASKS = 30;

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
    if (!isAllowedOrigin(origin, env?.ALLOWED_ORIGIN)) return jsonError(403, "ORIGIN_DENIED", "許可されていない公開元です", cors);
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return json({ ok: true, model: MODEL, noPaidFallback: true, aiBound: Boolean(env?.AI) }, env?.AI ? 200 : 503, cors);
  }

  if (!isAllowedOrigin(origin, env?.ALLOWED_ORIGIN)) return jsonError(403, "ORIGIN_DENIED", "許可されていない公開元です", cors);
  if (!env?.AI || typeof env.AI.run !== "function") return jsonError(503, "NOT_CONFIGURED", "Workers AIバインディングが設定されていません", cors);
  if (request.method !== "POST" || url.pathname !== "/recognize") return jsonError(404, "NOT_FOUND", "見つかりません", cors);

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) return jsonError(413, "IMAGE_TOO_LARGE", "画像が大きすぎます", cors);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "JSONを読み取れません", cors);
  }

  const subject = SUBJECTS.includes(payload?.subject) ? payload.subject : "";
  const weekStart = typeof payload?.weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.weekStart) ? payload.weekStart : "";
  const image = validateImage(payload?.image);
  if (!subject) return jsonError(400, "INVALID_SUBJECT", "科目が正しくありません", cors);
  if (!weekStart) return jsonError(400, "INVALID_WEEK", "週の開始日が正しくありません", cors);
  if (!image.ok) return jsonError(image.status, image.code, image.message, cors);

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content: "あなたは日本語の手書き学習目標を忠実に転記するOCR補助です。画像に書かれていない内容を追加せず、1行または1項目を1タスクとして抽出してください。回答はJSONだけにしてください。",
        },
        {
          role: "user",
          content: `${subject}の週間目標画像です。手書きされた勉強タスクを上から順に抽出してください。印刷された科目名・日付・罫線はタスクに含めません。形式は {"tasks":[{"text":"内容","confidence":0.0}]} とし、最大${MAX_TASKS}件、日本語、各160文字以内にしてください。`,
        },
      ],
      image: `data:${image.value.mimeType};base64,${image.value.data}`,
      temperature: 0.1,
      max_tokens: 1800,
    });
    const tasks = parseAiTasks(result);
    return json({ subject, weekStart, tasks, model: MODEL, noPaidFallback: true }, 200, cors);
  } catch (error) {
    const message = typeof error?.message === "string" ? error.message.slice(0, 180) : "Workers AIへ接続できません";
    return jsonError(502, "AI_REQUEST_FAILED", message, cors);
  }
}

export function parseAiTasks(result) {
  const text = extractResponseText(result);
  if (!text) throw new Error("AIから読み取り結果が返りませんでした");
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let value;
  try {
    value = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("AIの回答をJSONとして読み取れません");
    value = JSON.parse(cleaned.slice(start, end + 1));
  }
  if (!Array.isArray(value?.tasks)) throw new Error("AIのタスク一覧が正しくありません");
  const tasks = value.tasks.slice(0, MAX_TASKS).map((task) => {
    const textValue = typeof task?.text === "string" ? task.text.trim().replace(/\s+/g, " ").slice(0, 160) : "";
    if (!textValue) return null;
    return {
      text: textValue,
      confidence: Math.max(0, Math.min(1, Number(task.confidence) || 0)),
    };
  }).filter(Boolean);
  if (tasks.length === 0) throw new Error("手書きのタスクを読み取れませんでした");
  return tasks;
}

function extractResponseText(result) {
  if (typeof result === "string") return result;
  if (typeof result?.response === "string") return result.response;
  const choice = result?.choices?.[0]?.message?.content;
  if (typeof choice === "string") return choice;
  if (Array.isArray(choice)) return choice.map((item) => item?.text || "").join("");
  return "";
}

function validateImage(image) {
  if (!image || typeof image !== "object" || Array.isArray(image)) return invalid(400, "INVALID_IMAGE", "画像がありません");
  if (!["image/png", "image/jpeg"].includes(image.mimeType)) return invalid(400, "INVALID_IMAGE_TYPE", "画像形式が正しくありません");
  if (typeof image.data !== "string" || !/^[A-Za-z0-9+/=]+$/.test(image.data)) return invalid(400, "INVALID_IMAGE", "画像データが正しくありません");
  const estimatedBytes = Math.floor(image.data.length * 3 / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) return invalid(413, "IMAGE_TOO_LARGE", "画像が大きすぎます");
  return { ok: true, value: { mimeType: image.mimeType, data: image.data } };
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
    "X-Content-Type-Options": "nosniff",
  };
  if (isAllowedOrigin(origin, allowedOrigin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(value, status, headers) {
  return new Response(JSON.stringify(value), { status, headers });
}

function jsonError(status, code, message, headers) {
  return json({ error: { code, message } }, status, headers);
}
