if (typeof document !== "undefined") {
  ensureStyle();
  ensureWeeklyControls();
  ensureNoteControls();
  await import("../taskize-entry.js?v=20260720-10");
}

function ensureStyle() {
  if (document.querySelector('link[data-selection-style="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "selection.css?v=20260720-9";
  link.dataset.selectionStyle = "true";
  document.head.append(link);
}

function ensureWeeklyControls() {
  const toolGroup = document.querySelector(".weekly-tool-group");
  const toolbar = document.querySelector(".weekly-toolbar");
  const stage = document.querySelector("#weeklyCanvasStage");
  if (!toolGroup || !toolbar || !stage) return;

  if (!toolGroup.querySelector('[data-weekly-tool="select"]')) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "weekly-tool-button";
    button.dataset.weeklyTool = "select";
    button.setAttribute("aria-pressed", "false");
    button.textContent = "▧ 選ぶ";
    toolGroup.append(button);
  }

  if (!document.querySelector("#weeklySelectionHint")) {
    const hint = document.createElement("p");
    hint.id = "weeklySelectionHint";
    hint.className = "canvas-selection-hint";
    hint.hidden = true;
    hint.textContent = "手書きを囲んで選択してください";
    toolbar.append(hint);
  }

  if (!document.querySelector("#weeklySelectionActions")) {
    stage.append(createActions("weeklySelectionActions", "weeklyDeleteSelectionButton"));
  }
}

function ensureNoteControls() {
  const toolGroup = document.querySelector(".note-tool-group");
  const toolbar = document.querySelector(".note-toolbar");
  const stage = document.querySelector("#noteCanvasStage");
  if (!toolGroup || !toolbar || !stage) return;

  if (!toolGroup.querySelector('[data-note-tool="select"]')) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "note-tool-button";
    button.dataset.noteTool = "select";
    button.setAttribute("aria-pressed", "false");
    button.textContent = "▧ 選ぶ";
    toolGroup.append(button);
  }

  if (!document.querySelector("#noteSelectionHint")) {
    const hint = document.createElement("p");
    hint.id = "noteSelectionHint";
    hint.className = "canvas-selection-hint";
    hint.hidden = true;
    hint.textContent = "手書きを囲んで選択してください";
    toolbar.append(hint);
  }

  if (!document.querySelector("#noteSelectionActions")) {
    stage.append(createActions("noteSelectionActions", "noteDeleteSelectionButton"));
  }
}

function createActions(containerId, deleteButtonId) {
  const actions = document.createElement("div");
  actions.id = containerId;
  actions.className = "canvas-selection-actions";
  actions.hidden = true;

  const guide = document.createElement("span");
  guide.textContent = "ドラッグで移動・四隅で拡大";

  const deleteButton = document.createElement("button");
  deleteButton.id = deleteButtonId;
  deleteButton.type = "button";
  deleteButton.textContent = "削除";

  actions.append(guide, deleteButton);
  return actions;
}
