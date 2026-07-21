import { installTaskAssist } from "./ai-action-ui.js?v=20260721-1";

const assistButton = document.querySelector("#taskizeAiButton");
const panel = assistButton?.closest(".taskize-ai-panel");
const subjectInput = document.querySelector("#taskizeSubject");
const titleInput = document.querySelector("#taskizeTitle");
const minutesInput = document.querySelector("#taskizeMinutes");

if (panel && subjectInput && titleInput && minutesInput) {
  installTaskAssist({
    aiButton: assistButton,
    panel,
    subjectInput,
    titleInput,
    minutesInput,
  });
}
