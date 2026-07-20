import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const taskizeEntry = await readFile(new URL("../taskize-entry.js", import.meta.url), "utf8");
const dashboardEntry = await readFile(new URL("../dashboard-entry.js", import.meta.url), "utf8");
const dashboardUi = await readFile(new URL("../dashboard-ui.js", import.meta.url), "utf8");
const dashboardStyle = await readFile(new URL("../dashboard-style.js", import.meta.url), "utf8");

test("dashboard assets are loaded", () => {
  assert.match(taskizeEntry, /dashboard-entry\.js/);
  assert.match(dashboardEntry, /dashboard-style\.js/);
  assert.match(dashboardEntry, /dashboard-ui\.js/);
  assert.match(dashboardStyle, /\.study-dashboard/);
});

test("dashboard reads the existing task store", () => {
  assert.match(dashboardUi, /getTasksForDate/);
  assert.match(dashboardUi, /plannedMinutes/);
  assert.match(dashboardUi, /remainingMinutes/);
  assert.doesNotMatch(dashboardUi, /localStorage\.setItem/);
});

test("dashboard connects to existing actions", () => {
  assert.match(dashboardUi, /canvas-task-add-button/);
  assert.match(dashboardUi, /canvas-task-checkbox/);
  assert.match(dashboardUi, /canvas-task-carryover-button/);
  assert.match(dashboardUi, /#weeklyButton/);
});
