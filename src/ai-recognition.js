export const AI_SETTINGS_VERSION = 1;
export const AI_SETTINGS_KEY = "study-canvas:ai:v1";
export const AI_SUBJECTS = ["数学", "英語", "物理", "化学", "国語", "その他"];
export const MAX_AI_IMAGE_BYTES = 1_250_000;
const MAX_ENDPOINT_LENGTH = 500;
const MAX_ACCESS_TOKEN_LENGTH = 300;

export function emptyAiSettings() {
  return {
    version: AI_SETTINGS_VERSION,
    endpoint: "",
    accessToken: "",
    consented: false,
  };
}

export function loadAiSettings(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { settings: emptyAiSettings(), recovered: false };
  }

  try {
    const value = JSON.parse(raw);
    const settings = validateAiSettings(value, { allowEmpty: true });
    return {
      settings,
      recovered: JSON.stringify(value) !== JSON.stringify(settings),
    };
  } catch {
    return { settings: emptyAiSettings(), recovered: true };
  }
}

export function validateAiSettings(value, { allowEmpty = false } = {}) {
  const endpoint = typeof value?.endpoint === "string" ? value.endpoint.trim().replace(/\/+$/, "") : "";
  const accessToken = typeof value?.accessToken === "string" ? value.accessToken.trim() : "";
  const consented = value?.consented === true;

  if (allowEmpty && endpoint === "" && accessToken === "") {
    return { version: AI_SETTINGS_VERSION, endpoint: "", accessToken: "", consented };
  }
  if (!isSafeHttpsEndpoint(endpoint)) {
    throw new Error("AI中継URLはhttps://で始まるURLを入力してください");
  }
  if (endpoint.length > MAX_ENDPOINT_LENGTH) {
    throw new Error("AI中継URLが長すぎます");
  }
  if (accessToken.length < 20 || accessToken.length > MAX_ACCESS_TOKEN_LENGTH) {
    throw new Error("アクセストークンは20〜300文字で入力してください");
  }
  if (!consented) {
    throw new Error("選択画像をGoogle Geminiへ送信することへの確認が必要です");
  }
  return {
    version: AI_SETTINGS_VERSION,
    endpoint,
    accessToken,
    consented: true,
  };
}

export function serializeAiSettings(settings) {
  return JSON.stringify(validateAiSettings(settings));
}

export function clearAiSettings(storage) {
  storage.removeItem(AI_SETTINGS_KEY);
}

export function saveAiSettings(storage, settings) {
  const raw = serializeAiSettings(settings);
  storage.setItem(AI_SETTINGS_KEY, raw);
  if (storage.getItem(AI_SETTINGS_KEY) !== raw) {
    throw new Error("AI設定を保存できませんでした");
  }
  return JSON.parse(raw);
}

export function normalizeRecognitionCandidate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AIの回答形式が正しくありません");
  }

  const subject = AI_SUBJECTS.includes(value.subject) ? value.subject : "その他";
  const title = typeof value.title === "string" ? value.title.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  const rawMinutes = Number(value.minutes);
  const minutes = Number.isFinite(rawMinutes)
    ? Math.min(600, Math.max(5, Math.round(rawMinutes / 5) * 5))
    : 30;
  const rawConfidence = Number(value.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0;
  const warning = typeof value.warning === "string"
    ? value.warning.trim().replace(/\s+/g, " ").slice(0, 160)
    : "";

  if (!title) throw new Error("手書きから勉強内容を読み取れませんでした");
  return { subject, title, minutes, confidence, warning };
}

export function parseImageDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") throw new Error("選択画像を準備できませんでした");
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("選択画像の形式が正しくありません");
  const estimatedBytes = Math.floor(match[2].length * 3 / 4);
  if (estimatedBytes > MAX_AI_IMAGE_BYTES) {
    throw new Error("選択範囲が大きすぎます。もう少し狭く囲んでください");
  }
  return { mimeType: match[1], data: match[2], estimatedBytes };
}

export async function recognizeTaskWithAi({
  fetchImpl = globalThis.fetch,
  settings,
  imageDataUrl,
  signal,
}) {
  if (typeof fetchImpl !== "function") throw new Error("通信機能を利用できません");
  const safeSettings = validateAiSettings(settings);
  const image = parseImageDataUrl(imageDataUrl);
  const response = await fetchImpl(`${safeSettings.endpoint}/recognize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${safeSettings.accessToken}`,
    },
    body: JSON.stringify({
      image: {
        mimeType: image.mimeType,
        data: image.data,
      },
    }),
    signal,
  });

  const payload = await readJsonResponse(response);
  if (!response.ok) throw createRecognitionError(response.status, payload);
  return normalizeRecognitionCandidate(payload?.candidate);
}

export async function testAiConnection({
  fetchImpl = globalThis.fetch,
  settings,
  signal,
}) {
  if (typeof fetchImpl !== "function") throw new Error("通信機能を利用できません");
  const safeSettings = validateAiSettings(settings);
  const response = await fetchImpl(`${safeSettings.endpoint}/health`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${safeSettings.accessToken}` },
    signal,
  });
  const payload = await readJsonResponse(response);
  if (!response.ok || payload?.ok !== true) {
    throw createRecognitionError(response.status, payload);
  }
  return {
    model: typeof payload.model === "string" ? payload.model : "Gemini",
    noPaidFallback: payload.noPaidFallback === true,
  };
}

export function generateAccessToken(cryptoObject = globalThis.crypto) {
  if (!cryptoObject?.getRandomValues) throw new Error("安全なトークンを生成できません");
  const bytes = new Uint8Array(24);
  cryptoObject.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isSafeHttpsEndpoint(endpoint) {
  if (!endpoint.startsWith("https://")) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && url.username === "" && url.password === "" && url.search === "" && url.hash === "";
  } catch {
    return false;
  }
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function createRecognitionError(status, payload) {
  const code = payload?.error?.code;
  if (status === 401 || status === 403) {
    return new Error("AI設定を確認してください。中継URLまたはアクセストークンが一致していません");
  }
  if (status === 413) {
    return new Error("選択画像が大きすぎます。もう少し狭く囲んでください");
  }
  if (status === 429 || code === "FREE_TIER_LIMIT") {
    return new Error("無料枠の上限に達しました。時間を置いてから再度試してください");
  }
  if (status >= 500) {
    return new Error("AI側で一時的な問題が起きています。時間を置いて再度試してください");
  }
  const message = typeof payload?.error?.message === "string" ? payload.error.message.trim() : "";
  return new Error(message || "AIで読み取れませんでした");
}
