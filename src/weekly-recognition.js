export const WEEKLY_RECOGNITION_ENDPOINT = "https://study-canvas.soutarou-naka-1016.workers.dev";
export const MAX_WEEKLY_RECOGNITION_IMAGE_BYTES = 1_250_000;
export const MAX_WEEKLY_RECOGNITION_TASKS = 16;
export const WEEKLY_RECOGNITION_SUBJECTS = ["数学", "英語", "物理", "化学", "その他"];

export async function recognizeWeeklyCanvas({
  fetchImpl = globalThis.fetch,
  endpoint = WEEKLY_RECOGNITION_ENDPOINT,
  imageDataUrl,
  subject,
  weekStart,
  signal,
}) {
  if (typeof fetchImpl !== "function") throw new Error("通信機能を利用できません");
  const safeEndpoint = validateEndpoint(endpoint);
  const safeSubject = validateSubject(subject);
  const safeWeekStart = validateWeekStart(weekStart);
  const image = parseImageDataUrl(imageDataUrl);

  const response = await fetchImpl(`${safeEndpoint}/recognize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "weekly",
      subject: safeSubject,
      weekStart: safeWeekStart,
      image: { mimeType: image.mimeType, data: image.data },
    }),
    signal,
  });

  const payload = await readJsonResponse(response);
  if (!response.ok) throw createRecognitionError(response.status, payload);
  return normalizeWeeklyRecognitionTasks(payload?.tasks, safeSubject);
}

export function normalizeWeeklyRecognitionTasks(value, subject) {
  const safeSubject = validateSubject(subject);
  if (!Array.isArray(value)) throw new Error("AIの読み取り結果が正しくありません");
  const tasks = [];
  for (const item of value.slice(0, MAX_WEEKLY_RECOGNITION_TASKS)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const title = typeof item.title === "string" ? item.title.trim().replace(/\s+/g, " ").slice(0, 120) : "";
    if (!title) continue;
    const confidenceValue = Number(item.confidence);
    tasks.push({
      subject: safeSubject,
      title,
      confidence: Number.isFinite(confidenceValue) ? Math.min(1, Math.max(0, confidenceValue)) : 0,
      warning: typeof item.warning === "string" ? item.warning.trim().replace(/\s+/g, " ").slice(0, 160) : "",
    });
  }
  if (tasks.length === 0) throw new Error("手書きからタスクを読み取れませんでした");
  return tasks;
}

export function parseImageDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") throw new Error("週間目標の画像を準備できませんでした");
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("週間目標の画像形式が正しくありません");
  const estimatedBytes = Math.floor(match[2].length * 3 / 4);
  if (estimatedBytes > MAX_WEEKLY_RECOGNITION_IMAGE_BYTES) throw new Error("週間目標の画像が大きすぎます");
  return { mimeType: match[1], data: match[2], estimatedBytes };
}

function validateEndpoint(endpoint) {
  const normalized = typeof endpoint === "string" ? endpoint.trim().replace(/\/+$/, "") : "";
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error();
    return normalized;
  } catch {
    throw new Error("AI中継URLが正しくありません");
  }
}

function validateSubject(subject) {
  if (!WEEKLY_RECOGNITION_SUBJECTS.includes(subject)) throw new Error("科目が正しくありません");
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

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function createRecognitionError(status, payload) {
  const code = payload?.error?.code;
  if (status === 413) return new Error("画像が大きすぎます。書き込みを減らして再度試してください");
  if (status === 429 || code === "FREE_TIER_LIMIT") return new Error("AIの無料枠または利用回数の上限に達しました。時間を置いて再度試してください");
  if (status === 403) return new Error("公開元が許可されていません。Study Canvasの公開版から実行してください");
  if (status >= 500) return new Error("AI側で一時的な問題が起きています。既存のカードは変更されていません");
  const message = typeof payload?.error?.message === "string" ? payload.error.message.trim() : "";
  return new Error(message || "AIで読み取れませんでした。既存のカードは変更されていません");
}
