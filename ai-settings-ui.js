import {
  AI_SETTINGS_KEY,
  generateAccessToken,
  loadAiSettings,
  saveAiSettings,
  testAiConnection,
  validateAiSettings,
} from "./src/ai-recognition.js?v=20260720-13";

export function installAiSettings({ panel, showTaskMessage }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "taskize-ai-settings-button";
  button.textContent = "AI設定";
  panel.append(button);

  const privacy = document.createElement("small");
  privacy.className = "taskize-ai-privacy";
  privacy.textContent = "無料枠では送信内容がGoogleのサービス改善に使われる場合があります。画像はボタンを押した時だけ送信します。";
  panel.append(privacy);

  const dialog = createDialog();
  document.body.append(dialog);
  button.addEventListener("click", () => open(dialog));
  dialog.querySelectorAll("[data-ai-close]").forEach((item) => item.addEventListener("click", () => dialog.close()));
  dialog.querySelector("#aiSettingsForm").addEventListener("submit", (event) => save(event, dialog));
  dialog.querySelector("#aiTestButton").addEventListener("click", () => test(dialog));
  dialog.querySelector("#aiGenerateTokenButton").addEventListener("click", () => generate(dialog));
  dialog.querySelector("#aiClearButton").addEventListener("click", () => clear(dialog));

  return {
    open: () => open(dialog),
    load: () => loadAiSettings(localStorage.getItem(AI_SETTINGS_KEY)).settings,
    requireConfigured() {
      const settings = this.load();
      if (settings.endpoint && settings.accessToken && settings.consented) return settings;
      showTaskMessage("最初にAI中継URLとアクセストークンを設定してください。", true);
      open(dialog);
      return null;
    },
  };
}

function createDialog() {
  const dialog = document.createElement("dialog");
  dialog.id = "aiSettingsDialog";
  dialog.className = "ai-settings-dialog";
  dialog.innerHTML = `
    <form id="aiSettingsForm" class="ai-settings-form">
      <div class="taskize-dialog-header">
        <div><h2>AI手書き認識の設定</h2><p>GeminiのAPIキーはアプリへ保存せず、Cloudflare Workerで保護します。</p></div>
        <button type="button" class="dialog-close-button" data-ai-close aria-label="閉じる">×</button>
      </div>
      <label><span>Cloudflare Worker URL</span><input id="aiEndpoint" type="url" inputmode="url" autocomplete="off" placeholder="https://study-canvas-ai.example.workers.dev" required /></label>
      <label><span>アクセストークン</span><span class="ai-token-row"><input id="aiAccessToken" type="password" autocomplete="off" minlength="20" maxlength="300" required /><button id="aiGenerateTokenButton" type="button">生成</button></span></label>
      <label class="ai-consent-row"><input id="aiConsent" type="checkbox" required /><span>囲んだ手書き画像がGoogle Geminiへ送信され、無料枠ではサービス改善に使われる場合があることを確認しました。</span></label>
      <p class="ai-settings-note">課金を避けるにはGeminiへ請求先を登録せず、CloudflareはFreeプランのまま使います。無料枠を超えた場合は失敗し、有料処理へ自動切替しません。</p>
      <p id="aiSettingsMessage" class="taskize-message" role="status" aria-live="polite" hidden></p>
      <div class="ai-settings-actions"><button id="aiClearButton" type="button">設定を削除</button><button id="aiTestButton" type="button">接続テスト</button><button type="button" data-ai-close>キャンセル</button><button class="taskize-primary-button" type="submit">保存</button></div>
    </form>`;
  return dialog;
}

function open(dialog) {
  const settings = loadAiSettings(localStorage.getItem(AI_SETTINGS_KEY)).settings;
  dialog.querySelector("#aiEndpoint").value = settings.endpoint;
  dialog.querySelector("#aiAccessToken").value = settings.accessToken;
  dialog.querySelector("#aiConsent").checked = settings.consented;
  setMessage(dialog, "");
  if (!dialog.open) dialog.showModal();
}

function read(dialog) {
  return validateAiSettings({
    endpoint: dialog.querySelector("#aiEndpoint").value,
    accessToken: dialog.querySelector("#aiAccessToken").value,
    consented: dialog.querySelector("#aiConsent").checked,
  });
}

function save(event, dialog) {
  event.preventDefault();
  try {
    saveAiSettings(localStorage, read(dialog));
    setMessage(dialog, "AI設定をこの端末へ保存しました。");
  } catch (error) {
    setMessage(dialog, error?.message || "AI設定を保存できませんでした。", true);
  }
}

async function test(dialog) {
  const button = dialog.querySelector("#aiTestButton");
  button.disabled = true;
  setMessage(dialog, "接続を確認しています…");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const settings = read(dialog);
    const result = await testAiConnection({ settings, signal: controller.signal });
    saveAiSettings(localStorage, settings);
    setMessage(dialog, `${result.model}へ接続できました。自動の有料モデル切替: ${result.noPaidFallback ? "なし" : "未確認"}`, !result.noPaidFallback);
  } catch (error) {
    setMessage(dialog, error?.name === "AbortError" ? "接続確認がタイムアウトしました。" : error?.message || "接続できませんでした。", true);
  } finally {
    window.clearTimeout(timeout);
    button.disabled = false;
  }
}

function generate(dialog) {
  const input = dialog.querySelector("#aiAccessToken");
  input.value = generateAccessToken();
  input.focus();
  input.select();
  setMessage(dialog, "生成した値をCloudflareのACCESS_TOKENにも設定してください。");
}

function clear(dialog) {
  localStorage.removeItem(AI_SETTINGS_KEY);
  dialog.querySelector("#aiEndpoint").value = "";
  dialog.querySelector("#aiAccessToken").value = "";
  dialog.querySelector("#aiConsent").checked = false;
  setMessage(dialog, "この端末のAI設定を削除しました。");
}

function setMessage(dialog, text, isError = false) {
  const target = dialog.querySelector("#aiSettingsMessage");
  target.textContent = text;
  target.classList.toggle("is-error", isError);
  target.hidden = !text;
}
