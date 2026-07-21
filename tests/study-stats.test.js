import assert from "node:assert/strict";
import test from "node:test";
import {
  getWeekRange,
  summarizeTasksForDate,
  summarizeTasksForRange,
} from "../src/study-stats.js";

const store = {
  version: 1,
  tasksByDate: {
    "2026-07-19": [task("outside", "数学", 120, true)],
    "2026-07-20": [
      task("math-1", "数学", 60, true),
      task("english-1", "英語", 45, false),
    ],
    "2026-07-21": [
      task("physics-1", "物理", 90, true),
      task("math-2", "数学", 30, false),
    ],
    "2026-07-26": [task("chemistry-1", "化学", 60, false)],
    "2026-07-27": [task("outside-2", "英語", 90, true)],
  },
};

test("week range runs from Monday through Sunday", () => {
  assert.deepEqual(getWeekRange("2026-07-21"), {
    startDate: "2026-07-20",
    endDate: "2026-07-26",
  });
  assert.deepEqual(getWeekRange("2026-07-26"), {
    startDate: "2026-07-20",
    endDate: "2026-07-26",
  });
});

test("daily summary uses completed tasks as completed-equivalent minutes", () => {
  const summary = summarizeTasksForDate(store, "2026-07-21");
  assert.equal(summary.taskCount, 2);
  assert.equal(summary.completedTasks, 1);
  assert.equal(summary.plannedMinutes, 120);
  assert.equal(summary.completedMinutes, 90);
  assert.equal(summary.remainingMinutes, 30);
  assert.equal(summary.completionRate, 75);
});

test("weekly summary includes only dates inside the selected week", () => {
  const summary = summarizeTasksForRange(store, "2026-07-20", "2026-07-26");
  assert.equal(summary.taskCount, 5);
  assert.equal(summary.completedTasks, 2);
  assert.equal(summary.plannedMinutes, 285);
  assert.equal(summary.completedMinutes, 150);
  assert.equal(summary.remainingMinutes, 135);
  assert.equal(summary.completionRate, 53);
});

test("subject breakdown keeps subject order and completed-equivalent values", () => {
  const summary = summarizeTasksForRange(store, "2026-07-20", "2026-07-26");
  assert.deepEqual(summary.subjectBreakdown.map(({ subject }) => subject), ["数学", "英語", "物理", "化学"]);
  assert.deepEqual(summary.subjectBreakdown[0], {
    subject: "数学",
    plannedMinutes: 90,
    completedMinutes: 60,
    taskCount: 2,
    completedTaskCount: 1,
    remainingMinutes: 30,
    completionRate: 67,
  });
});

test("empty dates return zero values without inventing progress", () => {
  const summary = summarizeTasksForDate(store, "2026-07-22");
  assert.equal(summary.taskCount, 0);
  assert.equal(summary.plannedMinutes, 0);
  assert.equal(summary.completedMinutes, 0);
  assert.equal(summary.completionRate, 0);
  assert.deepEqual(summary.subjectBreakdown, []);
});

function task(id, subject, plannedMinutes, completed) {
  return {
    id,
    subject,
    title: id,
    plannedMinutes,
    completed,
    x: 0,
    y: 0,
  };
}
