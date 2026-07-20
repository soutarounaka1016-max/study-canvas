import { recognizeTaskWithAi } from "./src/ai-recognition.js?v=20260720-13";

export function installAiAction({ aiButton, panel, settings, previewCanvas, subjectInput, titleInput, minutesInput, showMessage }) {
  aiButton.textContent = "AIで読み取る（無料枠）";
  panel.querySelector("p").textContent = "囲んだ画像だけをGoogle Geminiへ送信し、候補を入力します。タスクは確認してから追加します。";

  aiButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const currentSettings = settings.requireConfigured();
    if (!currentSettings) return;

    let imageDataUrl;
    try {
      imageDataUrl = previewCanvas.toDataURL("image/png");
    } catch {
      showMessage("選択画像を準備できませんでした。", true);
      return;
    }

    aiButton.disabled = true;
    aiButton.textContent = "読み取り中…";
    showMessage("囲んだ画像だけをGeminiへ送信しています。タスクはまだ保存しません。", false);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    try {
      const candidate = await recognizeTaskWithAi({
        settings: currentSettings,
        imageDataUrl,
        signal: controller.signal,
      });
      subjectInput.value = candidate.subject;
      titleInput.value = candidate.title;
      minutesInput.value = String(candidate.minutes);
      titleInput.focus();
      titleInput.select();

      const confidence = Math.round(candidate.confidence * 100);
      const caution = candidate.confidence < 0.65 ? " 読み取りの確信が低いため、内容をよく確認してください。" : "";
      const warning = candidate.warning ? ` ${candidate.warning}` : "";
      showMessage(`AI候補を入力しました（信頼度 ${confidence}%）。確認してから「タスクを追加」を押してください。${caution}${warning}`, candidate.confidence < 0.45);
    } catch (error) {
      const text = error?.name === "AbortError"
        ? "AIの応答に時間がかかりすぎました。通信状態を確認して再度試してください。"
        : error?.message || "AIで読み取れませんでした。";
      showMessage(text, true);
    } finally {
      window.clearTimeout(timeout);
      aiButton.disabled = false;
      aiButton.textContent = "AIで読み取る（無料枠）";
    }
  }, { capture: true });
}
