const QUICK_SUBJECTS = ["数学", "英語", "物理", "化学", "国語", "その他"];
const QUICK_MINUTES = [30, 45, 60, 90, 120];

export function installTaskAssist({ aiButton, panel, subjectInput, titleInput, minutesInput }) {
  if (!panel || !subjectInput || !titleInput || !minutesInput) return;
  if (panel.querySelector(".taskize-quick-groups")) return;

  aiButton?.remove();
  panel.classList.add("taskize-assist-panel");

  const description = panel.querySelector("p");
  if (description) {
    description.textContent = "端末内OCRは実機で日本語の手書きを読み取れなかったため停止しました。科目と時間を選び、勉強内容だけ入力してください。";
  }

  const groups = document.createElement("div");
  groups.className = "taskize-quick-groups";

  const subjectGroup = createQuickGroup("科目", QUICK_SUBJECTS, (value) => {
    subjectInput.value = value;
    subjectInput.dispatchEvent(new Event("change", { bubbles: true }));
    titleInput.focus();
  });
  subjectGroup.classList.add("taskize-subject-quick-group");

  const minutesGroup = createQuickGroup("予定時間", QUICK_MINUTES.map(String), (value) => {
    minutesInput.value = value;
    minutesInput.dispatchEvent(new Event("input", { bubbles: true }));
    titleInput.focus();
  }, "分");
  minutesGroup.classList.add("taskize-minutes-quick-group");

  groups.append(subjectGroup, minutesGroup);

  const note = document.createElement("small");
  note.className = "taskize-assist-note";
  note.textContent = "勉強内容欄はキーボード入力に加え、対応しているiPadではApple Pencilの手書き入力も利用できます。";

  panel.append(groups, note);
  titleInput.placeholder = "例：微積の問題を2題";

  const syncButtons = () => {
    syncGroup(subjectGroup, subjectInput.value);
    syncGroup(minutesGroup, String(minutesInput.value));
  };

  subjectInput.addEventListener("change", syncButtons);
  minutesInput.addEventListener("input", syncButtons);
  panel.closest("dialog")?.addEventListener("close", syncButtons);
  syncButtons();
}

function createQuickGroup(label, values, onSelect, suffix = "") {
  const group = document.createElement("section");
  group.className = "taskize-quick-group";
  group.setAttribute("aria-label", `${label}の入力補助`);

  const heading = document.createElement("strong");
  heading.className = "taskize-quick-label";
  heading.textContent = label;

  const buttons = document.createElement("div");
  buttons.className = "taskize-quick-buttons";
  buttons.setAttribute("role", "group");

  for (const value of values) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "taskize-quick-button";
    button.dataset.quickValue = value;
    button.setAttribute("aria-pressed", "false");
    button.textContent = `${value}${suffix}`;
    button.addEventListener("click", () => onSelect(value));
    buttons.append(button);
  }

  group.append(heading, buttons);
  return group;
}

function syncGroup(group, value) {
  group.querySelectorAll(".taskize-quick-button").forEach((button) => {
    const selected = button.dataset.quickValue === value;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}
