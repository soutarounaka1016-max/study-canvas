import assert from "node:assert/strict";
import test from "node:test";

import {
  TASK_STORAGE_KEY,
  addTask,
  deleteTask,
  emptyTaskStore,
  getTasksForDate,
  loadTaskStore,
  replaceStoredTaskStore,
  serializeTaskStore,
  toggleTask,
  updateTask,
  updateTaskPosition,
  validateTaskInput,
} from "../src/task-store.js";

const date = "2026-07-20";
const input = { subject: "数学", title: "微積の演習", plannedMinutes: 60 };

test("空の保存値から空のタスクストアを作る", () => {
  assert.deepEqual(loadTaskStore(null), { store: emptyTaskStore(), recovered: false });
});

test("日付ごとにタスクを追加して読み出せる", () => {
  const store = addTask(emptyTaskStore(), date, input, "task-1");
  const [task] = getTasksForDate(store, date);
  assert.equal(task.id, "task-1");
  assert.equal(task.subject, "数学");
  assert.equal(task.title, "微積の演習");
  assert.equal(task.plannedMinutes, 60);
  assert.equal(task.completed, false);
  assert.equal(typeof task.x, "number");
  assert.equal(typeof task.y, "number");
  assert.deepEqual(getTasksForDate(store, "2026-07-21"), []);
});

test("タスク入力を検証する", () => {
  assert.deepEqual(validateTaskInput({ subject: "英語", title: " 長文1題 ", plannedMinutes: "30" }), {
    subject: "英語", title: "長文1題", plannedMinutes: 30,
  });
  assert.throws(() => validateTaskInput({ subject: "", title: "長文", plannedMinutes: 30 }), /科目/);
  assert.throws(() => validateTaskInput({ subject: "英語", title: "", plannedMinutes: 30 }), /勉強内容/);
  assert.throws(() => validateTaskInput({ subject: "英語", title: "長文", plannedMinutes: 0 }), /予定時間/);
});

test("タスクを編集しても位置と別日付のタスクを維持する", () => {
  let store = addTask(emptyTaskStore(), date, input, "task-1");
  store = updateTaskPosition(store, date, "task-1", { x: 0.4, y: 0.5 });
  store = addTask(store, "2026-07-21", { subject: "物理", title: "力学", plannedMinutes: 45 }, "task-2");
  store = updateTask(store, date, "task-1", { subject: "数学", title: "微積を2題", plannedMinutes: 50 });
  assert.equal(getTasksForDate(store, date)[0].title, "微積を2題");
  assert.equal(getTasksForDate(store, date)[0].x, 0.4);
  assert.equal(getTasksForDate(store, date)[0].y, 0.5);
  assert.equal(getTasksForDate(store, "2026-07-21")[0].title, "力学");
});

test("カード位置をキャンバス内へ制限する", () => {
  let store = addTask(emptyTaskStore(), date, input, "task-1");
  store = updateTaskPosition(store, date, "task-1", { x: -10, y: 10 });
  const [task] = getTasksForDate(store, date);
  assert.equal(task.x, 0);
  assert.ok(task.y < 1);
});

test("旧タスクデータに位置がなくても自動配置して読み込める", () => {
  const raw = JSON.stringify({
    version: 1,
    tasksByDate: {
      [date]: [{ id: "old", ...input, completed: false }],
    },
  });
  const loaded = loadTaskStore(raw);
  assert.equal(loaded.recovered, false);
  const [task] = getTasksForDate(loaded.store, date);
  assert.equal(typeof task.x, "number");
  assert.equal(typeof task.y, "number");
});

test("完了状態を切り替えられる", () => {
  let store = addTask(emptyTaskStore(), date, input, "task-1");
  store = toggleTask(store, date, "task-1");
  assert.equal(getTasksForDate(store, date)[0].completed, true);
  store = toggleTask(store, date, "task-1");
  assert.equal(getTasksForDate(store, date)[0].completed, false);
});

test("タスクを削除し、空になった日付を保存対象から外す", () => {
  let store = addTask(emptyTaskStore(), date, input, "task-1");
  store = deleteTask(store, date, "task-1");
  assert.deepEqual(store, emptyTaskStore());
});

test("壊れた保存データは安全な空ストアへ戻す", () => {
  assert.deepEqual(loadTaskStore("not-json"), { store: emptyTaskStore(), recovered: true });
  const invalid = JSON.stringify({ version: 1, tasksByDate: { bad: [{ id: "x" }] } });
  assert.deepEqual(loadTaskStore(invalid), { store: emptyTaskStore(), recovered: true });
});

test("保存後の読み戻しが一致しない場合は元データへ戻す", () => {
  const previous = serializeTaskStore(addTask(emptyTaskStore(), date, input, "old"));
  const next = addTask(emptyTaskStore(), date, { subject: "英語", title: "長文", plannedMinutes: 30 }, "new");
  let current = previous;
  let firstWrite = true;
  const storage = {
    getItem(key) {
      assert.equal(key, TASK_STORAGE_KEY);
      return current;
    },
    setItem(key, value) {
      assert.equal(key, TASK_STORAGE_KEY);
      if (firstWrite) {
        firstWrite = false;
        current = `${value}broken`;
      } else {
        current = value;
      }
    },
    removeItem() {
      current = null;
    },
  };

  assert.throws(() => replaceStoredTaskStore(storage, TASK_STORAGE_KEY, next), /確認/);
  assert.equal(current, previous);
});
