import test from "node:test";
import assert from "node:assert/strict";
import {
  SCHEDULE_STORAGE_KEY, emptyScheduleStore, getScheduleDay, loadScheduleStore,
  removeSchedulePlacement, replaceStoredScheduleStore, serializeScheduleStore,
  setScheduleDrawing, setSchedulePlacement,
} from "../src/schedule-store.js";

test("日付別の手書きとカード位置を保存して読み戻せる", () => {
  let store = emptyScheduleStore();
  store = setScheduleDrawing(store, "2026-08-04", { version: 1, date: "", strokes: [{ id: "s1", color: "#000", width: 5, points: [{ x: .2, y: .3 }] }] });
  store = setSchedulePlacement(store, "2026-08-04", "task-1", { x: .3, y: .5 });
  const loaded = loadScheduleStore(serializeScheduleStore(store));
  assert.equal(loaded.recovered, false);
  assert.equal(getScheduleDay(loaded.store, "2026-08-04").drawing.strokes.length, 1);
  assert.deepEqual(getScheduleDay(loaded.store, "2026-08-04").placements["task-1"], { x: .3, y: .5 });
});

test("カード位置だけを外しても手書きを維持する", () => {
  let store = setSchedulePlacement(emptyScheduleStore(), "2026-08-04", "task-1", { x: .1, y: .2 });
  store = removeSchedulePlacement(store, "2026-08-04", "task-1");
  assert.deepEqual(store.days, {});
});

test("保存後の読み戻し失敗時は元データへ戻す", () => {
  const data = new Map([[SCHEDULE_STORAGE_KEY, "before"]]);
  const storage = { getItem: (key) => data.get(key) ?? null, removeItem: (key) => data.delete(key), setItem: (key, value) => { data.set(key, value); if (value !== "before") data.set(key, "broken"); } };
  assert.throws(() => replaceStoredScheduleStore(storage, emptyScheduleStore()), /保存結果/);
  assert.equal(data.get(SCHEDULE_STORAGE_KEY), "before");
});
