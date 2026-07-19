import test from "node:test";
import assert from "node:assert/strict";
import { DrawingHistory, emptyDrawing, parseSavedDrawing, strokeTouchesPoint } from "../src/drawing-model.js";

const stroke = {
  id: "stroke-1", color: "#2558e6", width: 5,
  points: [{ x: 10, y: 10 }, { x: 100, y: 100 }],
};

test("保存した手書きデータを読み込める", () => {
  const saved = JSON.stringify({ version: 1, date: "2026-07-19", strokes: [stroke] });
  const result = parseSavedDrawing(saved, "2026-07-20");
  assert.equal(result.date, "2026-07-19");
  assert.deepEqual(result.strokes, [stroke]);
});

test("壊れた保存データは安全な白紙として扱う", () => {
  assert.deepEqual(parseSavedDrawing("{broken", "2026-07-19"), emptyDrawing("2026-07-19"));
  assert.deepEqual(parseSavedDrawing(JSON.stringify({ version: 99, strokes: [] }), "2026-07-19"), emptyDrawing("2026-07-19"));
});

test("取り消しとやり直しで手書きを復元できる", () => {
  const history = new DrawingHistory(emptyDrawing("2026-07-19"));
  history.commit({ version: 1, date: "2026-07-19", strokes: [stroke] });
  assert.equal(history.current.strokes.length, 1);
  history.undo();
  assert.equal(history.current.strokes.length, 0);
  history.redo();
  assert.equal(history.current.strokes.length, 1);
});

test("消しゴムが線分の近くに触れたことを判定する", () => {
  assert.equal(strokeTouchesPoint(stroke, { x: 55, y: 55 }, 10), true);
  assert.equal(strokeTouchesPoint(stroke, { x: 300, y: 300 }, 10), false);
});

test("履歴の最大数を超えた古い操作は破棄される", () => {
  const history = new DrawingHistory(emptyDrawing("2026-07-19"), 2);
  for (let index = 1; index <= 3; index += 1) {
    history.commit({ version: 1, date: "2026-07-19", strokes: Array(index).fill(stroke) });
  }
  history.undo();
  history.undo();
  assert.equal(history.current.strokes.length, 1);
  assert.equal(history.canUndo, false);
});
