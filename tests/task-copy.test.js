import assert from "node:assert/strict";
import test from "node:test";

import {
  addTask,
  emptyTaskStore,
  getTasksForDate,
  toggleTask,
} from "../src/task-store.js";
import {
  carryOverTasks,
  getCarryoverCandidates,
  getPreviousDate,
} from "../src/task-copy.js";

const math = "\u6570\u5b66";
const english = "\u82f1\u8a9e";
const physics = "\u7269\u7406";
const sourceDate = "2026-07-19";
const targetDate = "2026-07-20";

test("previous date crosses month and year boundaries", () => {
  assert.equal(getPreviousDate("2026-03-01"), "2026-02-28");
  assert.equal(getPreviousDate("2026-01-01"), "2025-12-31");
});

test("candidates include only unfinished tasks not already present", () => {
  let store = emptyTaskStore();
  store = addTask(store, sourceDate, { subject: math, title: "Calculus", plannedMinutes: 60 }, "source-1");
  store = addTask(store, sourceDate, { subject: english, title: "Reading", plannedMinutes: 30 }, "source-2");
  store = addTask(store, sourceDate, { subject: physics, title: "Mechanics", plannedMinutes: 45 }, "source-3");
  store = toggleTask(store, sourceDate, "source-3");
  store = addTask(store, targetDate, { subject: math, title: "Calculus", plannedMinutes: 60 }, "today-1");

  const candidates = getCarryoverCandidates(store, targetDate);
  assert.deepEqual(candidates.map((task) => task.id), ["source-2"]);
  assert.equal(candidates[0].sourceDate, sourceDate);
});

test("selected tasks are copied without changing the source day", () => {
  let store = emptyTaskStore();
  store = addTask(store, sourceDate, { subject: math, title: "Calculus", plannedMinutes: 60 }, "source-1");
  store = addTask(store, sourceDate, { subject: english, title: "Reading", plannedMinutes: 30 }, "source-2");
  store = addTask(store, targetDate, { subject: physics, title: "Mechanics", plannedMinutes: 45 }, "today-1");

  const next = carryOverTasks(store, targetDate, ["source-2"], () => "copied-1");

  assert.equal(getTasksForDate(next, sourceDate).length, 2);
  assert.deepEqual(getTasksForDate(next, sourceDate).map((task) => task.id), ["source-1", "source-2"]);

  const todayTasks = getTasksForDate(next, targetDate);
  assert.deepEqual(todayTasks.map((task) => task.id), ["today-1", "copied-1"]);
  assert.equal(todayTasks[1].subject, english);
  assert.equal(todayTasks[1].title, "Reading");
  assert.equal(todayTasks[1].plannedMinutes, 30);
  assert.equal(todayTasks[1].completed, false);
  assert.equal(typeof todayTasks[1].x, "number");
  assert.equal(typeof todayTasks[1].y, "number");
});

test("the same content cannot be copied twice", () => {
  let store = emptyTaskStore();
  store = addTask(store, sourceDate, { subject: math, title: "Calculus", plannedMinutes: 60 }, "source-1");
  store = carryOverTasks(store, targetDate, ["source-1"], () => "copied-1");

  assert.deepEqual(getCarryoverCandidates(store, targetDate), []);
  assert.throws(
    () => carryOverTasks(store, targetDate, ["source-1"], () => "copied-2"),
    /TASK_NOT_AVAILABLE/,
  );
});
