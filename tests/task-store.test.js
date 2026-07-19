import assert from "node:assert/strict";
import test from "node:test";
import {
  addTask, deleteTask, emptyTaskStore, getTasksForDate, parseTaskStore,
  serializeTaskStore, updateTask,
} from "../src/task-store.js";

const task = {
  id: "task-1", subject: "数学", title: "微積", minutes: 60,
  completed: false, x: 20, y: 30,
};

test("日付ごとにタスクを追加し、別の日と混ざらない", () => {
  const store = addTask(emptyTaskStore(), "2026-07-20", task);
  assert.deepEqual(getTasksForDate(store, "2026-07-20"), [task]);
  assert.deepEqual(getTasksForDate(store, "2026-07-21"), []);
});

test("完了状態と位置を更新できる", () => {
  const store = addTask(emptyTaskStore(), "2026-07-20", task);
  const updated = updateTask(store, "2026-07-20", task.id, { completed: true, x: 400, y: 500 });
  assert.equal(getTasksForDate(updated, "2026-07-20")[0].completed, true);
  assert.equal(getTasksForDate(updated, "2026-07-20")[0].x, 400);
  assert.equal(getTasksForDate(store, "2026-07-20")[0].completed, false);
});

test("指定したタスクだけを削除する", () => {
  let store = addTask(emptyTaskStore(), "2026-07-20", task);
  store = addTask(store, "2026-07-20", { ...task, id: "task-2", title: "英語" });
  const deleted = deleteTask(store, "2026-07-20", "task-1");
  assert.deepEqual(getTasksForDate(deleted, "2026-07-20").map(({ id }) => id), ["task-2"]);
});

test("不正な値を安全な範囲へ直して保存する", () => {
  const store = addTask(emptyTaskStore(), "2026-07-20", { ...task, minutes: 9999, x: -10, y: 9999 });
  const saved = JSON.parse(serializeTaskStore(store)).tasksByDate["2026-07-20"][0];
  assert.equal(saved.minutes, 600);
  assert.equal(saved.x, 0);
  assert.equal(saved.y, 840);
});

test("壊れたタスクデータを拒否する", () => {
  assert.equal(parseTaskStore("{broken"), null);
  assert.equal(parseTaskStore(JSON.stringify({ version: 99, tasksByDate: {} })), null);
});
