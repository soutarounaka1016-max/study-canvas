import assert from "node:assert/strict";
import test from "node:test";

import {
  WEEKLY_TASK_STORAGE_KEY,
  addWeeklyTasks,
  emptyWeeklyTaskStore,
  getWeeklyTasks,
  loadWeeklyTaskStore,
  replaceStoredWeeklyTaskStore,
  serializeWeeklyTaskStore,
} from "../src/weekly-task-store.js";

const week = "2026-07-27";

test("週と科目ごとに複数カードを保存して読み戻せる", () => {
  let sequence = 0;
  const store = addWeeklyTasks(emptyWeeklyTaskStore(), week, "数学", ["1対1対応を5問", "ベクトルを復習"], () => `id-${++sequence}`, new Date("2026-07-27T00:00:00Z"));
  assert.deepEqual(getWeeklyTasks(store, week, "数学").map((task) => task.text), ["1対1対応を5問", "ベクトルを復習"]);
  assert.equal(getWeeklyTasks(store, week, "英語").length, 0);
  const loaded = loadWeeklyTaskStore(serializeWeeklyTaskStore(store));
  assert.equal(loaded.recovered, false);
  assert.equal(getWeeklyTasks(loaded.store, week, "数学").length, 2);
});

test("空候補や不正な週を拒否する", () => {
  assert.throws(() => addWeeklyTasks(emptyWeeklyTaskStore(), week, "数学", ["  "]), /選んで/);
  assert.throws(() => addWeeklyTasks(emptyWeeklyTaskStore(), "2026-07-28", "数学", ["課題"]), /週の開始日/);
});

test("保存失敗時は以前のカードへロールバックする", () => {
  const previous = addWeeklyTasks(emptyWeeklyTaskStore(), week, "数学", ["以前のカード"], () => "old", new Date("2026-07-27T00:00:00Z"));
  const next = addWeeklyTasks(previous, week, "数学", ["新しいカード"], () => "new", new Date("2026-07-27T00:00:00Z"));
  const previousRaw = serializeWeeklyTaskStore(previous);
  let current = previousRaw;
  let firstWrite = true;
  const storage = {
    getItem(key) { assert.equal(key, WEEKLY_TASK_STORAGE_KEY); return current; },
    setItem(key, value) {
      assert.equal(key, WEEKLY_TASK_STORAGE_KEY);
      if (firstWrite) { firstWrite = false; current = `${value}broken`; }
      else current = value;
    },
    removeItem() { current = null; },
  };
  assert.throws(() => replaceStoredWeeklyTaskStore(storage, next), /確認/);
  assert.equal(current, previousRaw);
});

test("壊れた保存値は安全な空ストアへ戻す", () => {
  const loaded = loadWeeklyTaskStore("not-json");
  assert.deepEqual(loaded.store, emptyWeeklyTaskStore());
  assert.equal(loaded.recovered, true);
});
