import test from "node:test";
import assert from "node:assert/strict";

import {
  WEEKLY_SUBJECTS,
  getWeeklyDrawing,
  loadWeeklyStore,
  serializeWeeklyStore,
  setWeeklyDrawing,
} from "../src/weekly-store.js";

const week = "2026-07-20";
const drawing = {
  version: 1,
  date: week,
  strokes: [{ id: "stroke-1", color: "#2558e6", width: 5, points: [{ x: 10, y: 20 }, { x: 30, y: 40 }] }],
};

test("週間目標を5科目で別保存できる", () => {
  let store = loadWeeklyStore(null, week).store;
  store = setWeeklyDrawing(store, week, "数学", drawing);
  store = setWeeklyDrawing(store, week, "英語", { ...drawing, strokes: [{ ...drawing.strokes[0], id: "english" }] });

  assert.equal(getWeeklyDrawing(store, week, "数学").strokes[0].id, "stroke-1");
  assert.equal(getWeeklyDrawing(store, week, "英語").strokes[0].id, "english");
  assert.equal(getWeeklyDrawing(store, week, "物理").strokes.length, 0);
  assert.deepEqual(WEEKLY_SUBJECTS, ["数学", "英語", "物理", "化学", "その他"]);
});

test("旧週間キャンバスはその他へ移行して失わない", () => {
  const legacy = JSON.stringify({ version: 2, pages: { [week]: drawing } });
  const loaded = loadWeeklyStore(legacy, week);

  assert.equal(loaded.migrated, true);
  assert.equal(loaded.recovered, false);
  assert.equal(getWeeklyDrawing(loaded.store, week, "その他").strokes[0].id, "stroke-1");
  assert.equal(getWeeklyDrawing(loaded.store, week, "数学").strokes.length, 0);
});

test("科目別週間データは直列化後も保持される", () => {
  const initial = setWeeklyDrawing(loadWeeklyStore(null, week).store, week, "化学", drawing);
  const restored = loadWeeklyStore(serializeWeeklyStore(initial), week);

  assert.equal(restored.migrated, false);
  assert.equal(restored.recovered, false);
  assert.equal(getWeeklyDrawing(restored.store, week, "化学").strokes.length, 1);
});
