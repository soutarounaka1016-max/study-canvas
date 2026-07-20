import { installAiAction } from "./ai-action-ui.js?v=20260720-14";

const aiButton = document.querySelector("#taskizeAiButton");
const panel = aiButton?.closest(".taskize-ai-panel");
const previewCanvas = document.querySelector("#taskizePreview");
const subjectInput = document.querySelector("#taskizeSubject");
const titleInput = document.querySelector("#taskizeTitle");
const minutesInput = document.querySelector("#taskizeMinutes");
const message = document.querySelector("#taskizeMessage");

if (aiButton && panel && previewCanvas && subjectInput && titleInput && minutesInput && message) {
  const showMessage = (text, isError = false) => {
    message.textContent = text;
    message.classList.toggle("is-error", isError);
    message.hidden = false;
  };
  installAiAction({
    aiButton,
    panel,
    previewCanvas,
    subjectInput,
    titleInput,
    minutesInput,
    showMessage,
  });
}
