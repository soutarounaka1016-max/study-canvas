import assert from "node:assert/strict";
import test from "node:test";

import { emptyDrawing } from "../src/drawing-model.js";
import {
  WEEKLY_STORAGE_KEY,
  emptyWeeklyStore,
  getWeekEnd,
  getWeekStart,
  getWeeklyDrawing,
  loadWeeklyStore,
  replaceStoredWeeklyStore,
  serializeWeeklyStore,
  setWeeklyDrawing,
  shiftWeek,
} from "../src/weekly-store.js";

const monday = "2026-07-20";
const drawing = {
  version: 1,
  date: monday,
  strokes: [{ id: "stroke-1", color: "#2558e6", width: 5, points: [{ x: 10, y: 20 }] }],
};

test("どの日付からでも月曜日を週の開始日にする", () => {
  assert.equal(getWeekStart("2026-07-20"), monday);
  assert.equal(getWeekStart("2026-07-26"), monday);
  assert.equal(getWeekStart("2026-07-19"), "2026-07-13");
  assert.equal(getWeekEnd(monday), "2026-07-26");
});

test("前後の週へ7日単位で移動する", () => {
  assert.equal(shiftWeek(monday, -1), "2026-07-13");
  assert.equal(shiftWeek(monday, 1), "2026-07-27");
  assert.throws(() => shiftWeek(monday, 1.5), /移動量/);
});

test("週と科目ごとの手書きを別々に保存する", () => {
  let store = setWeeklyDrawing(emptyWeeklyStore(), monday, "数学", drawing);
  store = setWeeklyDrawing(store, "2026-07-27", "数学", emptyDrawing("2026-07-27"));
  store = setWeeklyDrawing(store, monday, "英語", { ...drawing, strokes: [{ ...drawing.strokes[0], id: "english" }] });
  assert.equal(getWeeklyDrawing(store, monday, "数学").strokes.length, 1);
  assert.equal(getWeeklyDrawing(store, monday, "英語").strokes[0].id, "english");
  assert.equal(getWeeklyDrawing(store, "2026-07-27", "数学").strokes.length, 0);
});

test("週の途中の日付を指定しても同じ週間目標を読む", () => {
  const store = setWeeklyDrawing(emptyWeeklyStore(), monday, "物理", drawing);
  assert.equal(getWeeklyDrawing(store, "2026-07-24", "物理").strokes[0].id, "stroke-1");
});

test("壊れた保存値は安全な空ストアへ戻す", () => {
  const result = loadWeeklyStore("not-json", monday);
  assert.deepEqual(result.store, emptyWeeklyStore());
  assert.equal(result.recovered, true);
});

test("旧形式は月曜日以外を除外し、正しい週をその他へ移行する", () => {
  const raw = JSON.stringify({
    version: 2,
    pages: {
      "2026-07-21": { ...drawing, date: "2026-07-21" },
      [monday]: drawing,
    },
  });
  const result = loadWeeklyStore(raw, monday);
  assert.deepEqual(Object.keys(result.store.weeks), [monday]);
  assert.equal(getWeeklyDrawing(result.store, monday, "その他").strokes.length, 1);
  assert.equal(result.recovered, true);
  assert.equal(result.migrated, true);
});

test("週間目標をJSONへ直列化して読み戻せる", () => {
  const store = setWeeklyDrawing(emptyWeeklyStore(), monday, "化学", drawing);
  const loaded = loadWeeklyStore(serializeWeeklyStore(store), monday);
  assert.equal(getWeeklyDrawing(loaded.store, monday, "化学").strokes.length, 1);
  assert.equal(loaded.recovered, false);
});

test("保存結果が一致しない場合は以前の週間データへ戻す", () => {
  const previousStore = setWeeklyDrawing(emptyWeeklyStore(), monday, "数学", drawing);
  const nextStore = setWeeklyDrawing(previousStore, "2026-07-27", "数学", {
    ...drawing,
    date: "2026-07-27",
    strokes: [{ ...drawing.strokes[0], id: "stroke-2" }],
  });
  const previousRaw = serializeWeeklyStore(previousStore);
  let current = previousRaw;
  let firstWrite = true;
  const storage = {
    getItem(key) {
      assert.equal(key, WEEKLY_STORAGE_KEY);
      return current;
    },
    setItem(key, value) {
      assert.equal(key, WEEKLY_STORAGE_KEY);
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

  assert.throws(() => replaceStoredWeeklyStore(storage, WEEKLY_STORAGE_KEY, nextStore), /確認/);
  assert.equal(current, previousRaw);
});
