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
  validateTaskInput,
} from "../src/task-store.js";

const date = "2026-07-20";
const input = { subject: "数学", title: "微積の演習", plannedMinutes: 60 };

test("空の保存値から空のタスクストアを作る", () => {
  assert.deepEqual(loadTaskStore(null), { store: emptyTaskStore(), recovered: false });
});

test("日付ごとにタスクを追加して読み出せる", () => {
  const store = addTask(emptyTaskStore(), date, input, "task-1");
  assert.deepEqual(getTasksForDate(store, date), [
    { id: "task-1", subject: "数学", title: "微積の演習", plannedMinutes: 60, completed: false },
  ]);
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

test("タスクを編集しても別日付のタスクを維持する", () => {
  let store = addTask(emptyTaskStore(), date, input, "task-1");
  store = addTask(store, "2026-07-21", { subject: "物理", title: "力学", plannedMinutes: 45 }, "task-2");
  store = updateTask(store, date, "task-1", { subject: "数学", title: "微積を2題", plannedMinutes: 50 });
  assert.equal(getTasksForDate(store, date)[0].title, "微積を2題");
  assert.equal(getTasksForDate(store, "2026-07-21")[0].title, "力学");
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
