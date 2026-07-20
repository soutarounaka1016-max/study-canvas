import {
  recognizeTaskWithLocalOcr,
  shutdownLocalOcr,
} from "./src/local-ocr.js?v=20260720-14";

export function installAiAction({ aiButton, panel, previewCanvas, subjectInput, titleInput, minutesInput, showMessage }) {
  aiButton.textContent = "端末内OCRで読み取る";
  panel.querySelector("p").textContent = "囲んだ画像をiPad内で文字認識し、候補を入力します。タスクは確認してから追加します。";

  const privacy = document.createElement("small");
  privacy.className = "taskize-ai-privacy";
  privacy.textContent = "画像は端末外へ送信しません。初回だけOCR本体と日本語データを読み込み、以後はブラウザへキャッシュされます。";
  panel.append(privacy);

  aiButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    aiButton.disabled = true;
    aiButton.textContent = "OCR準備中…";
    showMessage("端末内OCRを準備しています。初回は日本語データの読み込みに時間がかかる場合があります。", false);

    try {
      const candidate = await recognizeTaskWithLocalOcr({
        image: previewCanvas,
        onProgress: ({ status, progress }) => {
          const percent = Math.round(progress * 100);
          aiButton.textContent = progress > 0 ? `${percent}%` : "OCR準備中…";
          showMessage(formatProgress(status, percent), false);
        },
      });

      subjectInput.value = candidate.subject;
      titleInput.value = candidate.title;
      minutesInput.value = String(candidate.minutes);
      titleInput.focus();
      titleInput.select();

      const confidence = Math.round(candidate.confidence * 100);
      const caution = candidate.confidence < 0.65
        ? " 読み取りの確信が低いため、内容をよく確認してください。"
        : "";
      const warning = candidate.warning ? ` ${candidate.warning}。` : "";
      const rawText = candidate.rawText ? ` 認識文字:「${candidate.rawText}」` : "";
      showMessage(
        `端末内OCRの候補を入力しました（信頼度 ${confidence}%）。確認してから「タスクを追加」を押してください。${caution}${warning}${rawText}`,
        candidate.confidence < 0.45,
      );
    } catch (error) {
      showMessage(error?.message || "端末内OCRで読み取れませんでした。手動入力を利用してください。", true);
    } finally {
      aiButton.disabled = false;
      aiButton.textContent = "端末内OCRで読み取る";
    }
  }, { capture: true });

  window.addEventListener("pagehide", () => {
    void shutdownLocalOcr();
  }, { once: true });
}

function formatProgress(status, percent) {
  const labels = {
    "loading tesseract core": "OCRエンジンを読み込んでいます",
    "initializing tesseract": "OCRエンジンを準備しています",
    "loading language traineddata": "日本語の認識データを読み込んでいます",
    "initializing api": "日本語OCRを準備しています",
    "recognizing text": "選択した手書きを読み取っています",
  };
  const label = labels[status] || "端末内OCRを処理しています";
  return percent > 0 ? `${label}（${percent}%）` : `${label}…`;
}
