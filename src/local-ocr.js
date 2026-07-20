export const LOCAL_OCR_LIBRARY_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js";
export const LOCAL_OCR_WORKER_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js";
export const LOCAL_OCR_CORE_URL = "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0";
export const LOCAL_OCR_LANGUAGE_URL = "https://tessdata.projectnaptha.com/4.0.0";

const SUBJECT_RULES = [
  {
    subject: "数学",
    explicit: /(?:^|\s)(?:数学|数[ⅠⅡⅢIVI1-3ABCabcＡ-Ｃａ-ｃ]+)(?=\s|$)/u,
    clue: /微分|積分|微積|数列|ベクトル|確率|整数|図形|方程式|不等式/u,
  },
  {
    subject: "英語",
    explicit: /(?:^|\s)(?:英語|英文|English)(?=\s|$)/iu,
    clue: /長文|英単語|単語帳|英文解釈|英作文|文法|リスニング|リーディング/u,
  },
  {
    subject: "物理",
    explicit: /(?:^|\s)物理(?=\s|$)/u,
    clue: /力学|電磁気|波動|熱力学|原子|コンデンサー|運動方程式|電場|磁場/u,
  },
  {
    subject: "化学",
    explicit: /(?:^|\s)化学(?=\s|$)/u,
    clue: /有機|無機|理論化学|化学反応|酸化還元|電池|平衡|モル|高分子/u,
  },
  {
    subject: "国語",
    explicit: /(?:^|\s)(?:国語|現代文|古文|漢文)(?=\s|$)/u,
    clue: /評論|小説|古典|漢字|語彙/u,
  },
];

const DURATION_PATTERNS = [
  /(?<hours>\d+(?:\.\d+)?)\s*時間(?:\s*(?<minutes>\d{1,3})\s*分)?/u,
  /(?<minutes>\d{1,3})\s*(?:分|ふん|ぷん|mins?|minutes?)/iu,
  /(?:^|\s)(?<minutes>\d{1,3})(?=\s*$)/u,
];

let workerPromise = null;
let activeProgressListener = null;

export function normalizeLocalOcrText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[|｜:：,，、・]/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function parseLocalOcrCandidate(value, ocrConfidence = 0) {
  const text = normalizeLocalOcrText(value);
  if (!text) throw new Error("手書き文字を読み取れませんでした。手動入力を利用してください");

  const subjectInfo = detectSubject(text);
  const durationInfo = detectDuration(text);
  const title = buildTitle(text, subjectInfo.explicitMatch, durationInfo.match);
  if (!title) throw new Error("勉強内容を読み取れませんでした。内容欄へ手動で入力してください");

  const warnings = [];
  if (subjectInfo.subject === "その他") warnings.push("科目を特定できなかったため「その他」にしました");
  if (!durationInfo.found) warnings.push("時間を特定できなかったため30分にしました");

  const rawConfidence = Number(ocrConfidence);
  const engineConfidence = Number.isFinite(rawConfidence)
    ? clamp(rawConfidence > 1 ? rawConfidence / 100 : rawConfidence, 0, 1)
    : 0;
  const structureScore = (subjectInfo.subject !== "その他" ? 0.15 : 0)
    + (durationInfo.found ? 0.15 : 0)
    + (title.length >= 2 ? 0.1 : 0);
  const confidence = clamp(engineConfidence * 0.6 + structureScore, 0, 1);

  return {
    subject: subjectInfo.subject,
    title: title.slice(0, 120),
    minutes: durationInfo.minutes,
    confidence,
    warning: warnings.join("。"),
    rawText: text.slice(0, 300),
  };
}

export async function recognizeTaskWithLocalOcr({ image, onProgress } = {}) {
  if (!image || typeof image.width !== "number" || typeof image.height !== "number") {
    throw new Error("選択画像を準備できませんでした");
  }
  if (typeof globalThis.Worker !== "function" || typeof globalThis.WebAssembly !== "object") {
    throw new Error("このブラウザでは端末内OCRを利用できません");
  }

  activeProgressListener = typeof onProgress === "function" ? onProgress : null;
  try {
    const worker = await getLocalOcrWorker();
    const prepared = prepareImageForOcr(image);
    const result = await worker.recognize(prepared);
    return parseLocalOcrCandidate(result?.data?.text, result?.data?.confidence);
  } catch (error) {
    if (isNetworkLikeError(error)) {
      throw new Error("OCR本体または日本語データを読み込めませんでした。通信環境を確認してください");
    }
    throw error;
  } finally {
    activeProgressListener = null;
  }
}

export async function shutdownLocalOcr() {
  const pending = workerPromise;
  workerPromise = null;
  if (!pending) return;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // A failed worker has already released its own resources.
  }
}

async function getLocalOcrWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const module = await import(LOCAL_OCR_LIBRARY_URL);
      const worker = await module.createWorker("jpn", 1, {
        workerPath: LOCAL_OCR_WORKER_URL,
        corePath: LOCAL_OCR_CORE_URL,
        langPath: LOCAL_OCR_LANGUAGE_URL,
        logger(message) {
          activeProgressListener?.({
            status: String(message?.status || ""),
            progress: clamp(Number(message?.progress) || 0, 0, 1),
          });
        },
      });
      await worker.setParameters({
        tessedit_pageseg_mode: "6",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
      return worker;
    })().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

function prepareImageForOcr(source) {
  const sourceWidth = Math.max(1, Math.round(source.width));
  const sourceHeight = Math.max(1, Math.round(source.height));
  const scale = Math.min(3, Math.max(2, 1200 / sourceWidth));
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(1800, Math.max(1, Math.round(sourceWidth * scale)));
  canvas.height = Math.min(900, Math.max(1, Math.round(sourceHeight * scale)));
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!context) throw new Error("OCR用画像を準備できませんでした");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
      const ink = gray < 224;
      const value = ink ? 0 : 255;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
      if (ink) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) throw new Error("選択範囲に読み取れる手書きがありません");
  context.putImageData(imageData, 0, 0);

  const padding = 28;
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(canvas.width - cropX, maxX - minX + 1 + padding * 2);
  const cropHeight = Math.min(canvas.height - cropY, maxY - minY + 1 + padding * 2);
  const cropped = document.createElement("canvas");
  cropped.width = cropWidth;
  cropped.height = cropHeight;
  const croppedContext = cropped.getContext("2d", { alpha: false });
  if (!croppedContext) throw new Error("OCR用画像を準備できませんでした");
  croppedContext.fillStyle = "#ffffff";
  croppedContext.fillRect(0, 0, cropWidth, cropHeight);
  croppedContext.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return cropped;
}

function detectSubject(text) {
  const compact = text.replace(/\s+/g, "");
  for (const rule of SUBJECT_RULES) {
    const explicitMatch = text.match(rule.explicit);
    if (explicitMatch) return { subject: rule.subject, explicitMatch };
  }
  for (const rule of SUBJECT_RULES) {
    if (rule.clue.test(compact)) return { subject: rule.subject, explicitMatch: null };
  }
  return { subject: "その他", explicitMatch: null };
}

function detectDuration(text) {
  for (const pattern of DURATION_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const hours = Number(match.groups?.hours || 0);
    const minutesPart = Number(match.groups?.minutes || 0);
    const rawMinutes = hours > 0 ? hours * 60 + minutesPart : minutesPart;
    if (!Number.isFinite(rawMinutes) || rawMinutes <= 0) continue;
    return {
      found: true,
      minutes: clamp(Math.round(rawMinutes / 5) * 5, 5, 600),
      match,
    };
  }
  return { found: false, minutes: 30, match: null };
}

function buildTitle(text, subjectMatch, durationMatch) {
  let title = text;
  if (subjectMatch?.[0]) title = title.replace(subjectMatch[0], " ");
  if (durationMatch?.[0]) title = title.replace(durationMatch[0], " ");
  return title
    .replace(/(?:^|\s)(?:科目|内容|予定|勉強|時間)(?=\s|$)/gu, " ")
    .replace(/[()（）\[\]【】]/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNetworkLikeError(error) {
  const message = String(error?.message || error || "");
  return /fetch|network|load|import|worker|wasm|traineddata/i.test(message);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
