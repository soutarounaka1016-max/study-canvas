import test from "node:test";
import assert from "node:assert/strict";
import {
  addTaskFromHandwriting,
  hasDuplicateTask,
  selectDrawingByLasso,
} from "../src/taskize-model.js";
import { emptyTaskStore } from "../src/task-store.js";

const drawing = {
  version: 1,
  date: "2026-07-20",
  strokes: [
    { id: "inside", color: "#111827", width: 5, points: [{ x: 100, y: 100 }, { x: 200, y: 200 }] },
    { id: "outside", color: "#111827", width: 5, points: [{ x: 600, y: 600 }, { x: 700, y: 700 }] },
  ],
};

test("lasso returns only selected handwriting", () => {
  const selected = selectDrawingByLasso(drawing, [
    { x: 50, y: 50 }, { x: 250, y: 50 }, { x: 250, y: 250 }, { x: 50, y: 250 },
  ]);
  assert.deepEqual(selected.strokes.map((stroke) => stroke.id), ["inside"]);
  assert.equal(drawing.strokes.length, 2);
});

test("taskization adds a new incomplete task", () => {
  const next = addTaskFromHandwriting(emptyTaskStore(), "2026-07-20", {
    subject: "数学",
    title: "微積の問題を2題",
    plannedMinutes: 30,
  }, "task-1");
  assert.equal(next.tasksByDate["2026-07-20"][0].completed, false);
});

test("same task is detected as duplicate", () => {
  const store = addTaskFromHandwriting(emptyTaskStore(), "2026-07-20", {
    subject: "数学",
    title: "微積の問題を2題",
    plannedMinutes: 30,
  }, "task-1");
  assert.equal(hasDuplicateTask(store, "2026-07-20", {
    subject: "数学",
    title: "微積の問題を2題",
    plannedMinutes: 30,
  }), true);
  assert.throws(() => addTaskFromHandwriting(store, "2026-07-20", {
    subject: "数学",
    title: "微積の問題を2題",
    plannedMinutes: 30,
  }, "task-2"), /DUPLICATE_TASK/);
});
