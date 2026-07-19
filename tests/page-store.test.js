import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGE_STORE_VERSION,
  emptyPageStore,
  getPageDrawing,
  listWrittenPageDates,
  loadPageStore,
  serializePageStore,
  setPageDrawing,
  shiftDate,
} from "../src/page-store.js";

const stroke = {
  id: "stroke-1",
  color: "#2558e6",
  width: 5,
  points: [{ x: 10, y: 10 }, { x: 100, y: 100 }],
};

test("v1の手書きを今日のページへ移行し、元データを書き換えない", () => {
  const legacy = JSON.stringify({ version: 1, date: "2026-07-18", strokes: [stroke] });
  const result = loadPageStore(null, legacy, "2026-07-19");

  assert.equal(result.migrated, true);
  assert.equal(result.store.version, PAGE_STORE_VERSION);
  assert.equal(getPageDrawing(result.store, "2026-07-19").date, "2026-07-19");
  assert.deepEqual(getPageDrawing(result.store, "2026-07-19").strokes, [stroke]);
  assert.equal(legacy, JSON.stringify({ version: 1, date: "2026-07-18", strokes: [stroke] }));
});

test("v2がある場合はv1を重ねて移行しない", () => {
  const existing = setPageDrawing(emptyPageStore(), "2026-07-18", {
    version: 1, date: "2026-07-18", strokes: [stroke],
  });
  const legacy = JSON.stringify({ version: 1, date: "2026-07-19", strokes: [] });
  const result = loadPageStore(serializePageStore(existing), legacy, "2026-07-19");

  assert.equal(result.migrated, false);
  assert.deepEqual(getPageDrawing(result.store, "2026-07-18").strokes, [stroke]);
  assert.deepEqual(getPageDrawing(result.store, "2026-07-19").strokes, []);
});

test("壊れたv2からv1へ安全に復旧する", () => {
  const legacy = JSON.stringify({ version: 1, date: "2026-07-18", strokes: [stroke] });
  const result = loadPageStore("{broken", legacy, "2026-07-19");

  assert.equal(result.recovered, true);
  assert.equal(result.migrated, true);
  assert.deepEqual(getPageDrawing(result.store, "2026-07-19").strokes, [stroke]);
});

test("日付ごとの手書きが混ざらない", () => {
  const first = setPageDrawing(emptyPageStore(), "2026-07-18", {
    version: 1, date: "2026-07-18", strokes: [stroke],
  });
  const second = setPageDrawing(first, "2026-07-19", {
    version: 1, date: "2026-07-19", strokes: [],
  });

  assert.equal(getPageDrawing(second, "2026-07-18").strokes.length, 1);
  assert.equal(getPageDrawing(second, "2026-07-19").strokes.length, 0);
});

test("手書きがあるページだけを新しい日付順で一覧にする", () => {
  const first = setPageDrawing(emptyPageStore(), "2026-07-17", {
    version: 1, date: "2026-07-17", strokes: [stroke],
  });
  const blank = setPageDrawing(first, "2026-07-18", {
    version: 1, date: "2026-07-18", strokes: [],
  });
  const latest = setPageDrawing(blank, "2026-07-19", {
    version: 1, date: "2026-07-19", strokes: [stroke],
  });

  assert.deepEqual(listWrittenPageDates(latest), ["2026-07-19", "2026-07-17"]);
});

test("前日・翌日を月や年をまたいで計算できる", () => {
  assert.equal(shiftDate("2026-07-01", -1), "2026-06-30");
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
});
