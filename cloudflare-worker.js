const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_IMAGE_BYTES = 1_250_000;
const MAX_REQUEST_BYTES = 1_800_000;

export default {
  async fetch(request, env) {
    return handleRequest(request, env, globalThis.fetch);
  },
};

export async function handleRequest(request, env, fetchImpl = globalThis.fetch) {
  const origin = request.headers.get("Origin") || "";
  const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

  if (request.method === "OPTIONS") {
    if (!isAllowedOrigin(origin, env.ALLOWED_ORIGIN)) return jsonError(403, "ORIGIN_DENIED", "許可されていない公開元です", cors);
    return new Response(null, { status: 204, headers: cors });
  }

  if (!isConfigured(env)) return jsonError(503, "NOT_CONFIGURED", "AI中継が設定されていません", cors);
  if (!isAllowedOrigin(origin, env.ALLOWED_ORIGIN)) return jsonError(403, "ORIGIN_DENIED", "許可されていない公開元です", cors);
  if (!authorized(request, env.ACCESS_TOKEN)) return jsonError(401, "UNAUTHORIZED", "アクセストークンが一致しません", cors);

  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    return json({ ok: true, model: GEMINI_MODEL, noPaidFallback: true }, 200, cors);
  }
  if (request.method !== "POST" || url.pathname !== "/recognize") {
    return jsonError(404, "NOT_FOUND", "見つかりません", cors);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) return jsonError(413, "IMAGE_TOO_LARGE", "画像が大きすぎます", cors);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "JSONを読み取れません", cors);
  }

  const image = validateImage(payload?.image);
  if (!image.ok) return jsonError(image.status, image.code, image.message, cors);

  const geminiResponse = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify(createGeminiPayload(image.value)),
    },
  );

  let geminiPayload = {};
  try {
    geminiPayload = await geminiResponse.json();
  } catch {
    return jsonError(502, "INVALID_AI_RESPONSE", "AIの回答を読み取れません", cors);
  }

  if (geminiResponse.status === 429) {
    return jsonError(429, "FREE_TIER_LIMIT", "無料枠の上限に達しました", cors);
  }
  if (!geminiResponse.ok) {
    const message = geminiPayload?.error?.message;
    return jsonError(geminiResponse.status >= 500 ? 502 : 400, "AI_REQUEST_FAILED", typeof message === "string" ? message.slice(0, 180) : "AIへ接続できません", cors);
  }

  try {
    const candidate = parseGeminiCandidate(geminiPayload);
    return json({ candidate, model: GEMINI_MODEL }, 200, cors);
  } catch (error) {
    return jsonError(422, "INVALID_AI_RESULT", error?.message || "AIの候補が正しくありません", cors);
  }
}

export function createGeminiPayload(image) {
  return {
    contents: [{
      role: "user",
      parts: [
        {
          text: "画像は高校生の受験勉強メモです。画像内の手書きだけを読み、実行可能な勉強タスク1件へ整理してください。書かれていない内容は推測しすぎないでください。予定時間が書かれていない場合は内容から保守的に推定してください。科目は数学、英語、物理、化学、国語、その他のいずれかです。日本語で返してください。",
        },
        { inlineData: { mimeType: image.mimeType, data: image.data } },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 320,
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        properties: {
          subject: { type: "string", enum: ["数学", "英語", "物理", "化学", "国語", "その他"] },
          title: { type: "string", description: "120文字以内の具体的な勉強内容" },
          minutes: { type: "integer", minimum: 5, maximum: 600 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          warning: { type: "string", description: "読みにくさや不確実性。なければ空文字" },
        },
        required: ["subject", "title", "minutes", "confidence", "warning"],
        additionalProperties: false,
      },
    },
  };
}

export function parseGeminiCandidate(payload) {
  const text = payload?.candidates?.[0]?.content?.parts?.find((part) => typeof part?.text === "string")?.text;
  if (!text) throw new Error("AIから候補が返りませんでした");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("AIの候補をJSONとして読み取れません");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AIの候補形式が正しくありません");
  const subjects = ["数学", "英語", "物理", "化学", "国語", "その他"];
  if (!subjects.includes(value.subject)) throw new Error("AIの科目が正しくありません");
  const title = typeof value.title === "string" ? value.title.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  if (!title) throw new Error("勉強内容を読み取れませんでした");
  const minutes = Number(value.minutes);
  if (!Number.isFinite(minutes)) throw new Error("予定時間を読み取れませんでした");
  return {
    subject: value.subject,
    title,
    minutes: Math.min(600, Math.max(5, Math.round(minutes / 5) * 5)),
    confidence: Math.min(1, Math.max(0, Number(value.confidence) || 0)),
    warning: typeof value.warning === "string" ? value.warning.trim().replace(/\s+/g, " ").slice(0, 160) : "",
  };
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

function isConfigured(env) {
  return Boolean(env?.GEMINI_API_KEY && env?.ACCESS_TOKEN && env?.ALLOWED_ORIGIN);
}

function isAllowedOrigin(origin, allowedOrigin) {
  if (!origin || !allowedOrigin) return false;
  try {
    return new URL(origin).origin === new URL(allowedOrigin).origin;
  } catch {
    return false;
  }
}

function authorized(request, expectedToken) {
  const header = request.headers.get("Authorization") || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  return constantTimeEqual(supplied, expectedToken || "");
}

function constantTimeEqual(first, second) {
  const length = Math.max(first.length, second.length);
  let difference = first.length ^ second.length;
  for (let index = 0; index < length; index += 1) difference |= (first.charCodeAt(index) || 0) ^ (second.charCodeAt(index) || 0);
  return difference === 0;
}

function corsHeaders(origin, allowedOrigin) {
  const headers = {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
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
