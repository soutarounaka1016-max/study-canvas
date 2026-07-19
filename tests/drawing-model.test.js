import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteSelectedStrokes,
  DrawingHistory,
  emptyDrawing,
  moveSelectedStrokes,
  parseSavedDrawing,
  selectStrokeIdsByLasso,
  strokeTouchesPoint,
} from "../src/drawing-model.js";

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

test("投げ縄に一部が触れた手書きだけを選ぶ", () => {
  const outside = { ...stroke, id: "outside", points: [{ x: 500, y: 500 }, { x: 600, y: 600 }] };
  const drawing = { version: 1, date: "2026-07-19", strokes: [stroke, outside] };
  const lasso = [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }];
  assert.deepEqual(selectStrokeIdsByLasso(drawing, lasso), ["stroke-1"]);
});

test("選んだ手書きだけをまとめて移動する", () => {
  const outside = { ...stroke, id: "outside", points: [{ x: 500, y: 500 }, { x: 600, y: 600 }] };
  const drawing = { version: 1, date: "2026-07-19", strokes: [stroke, outside] };
  const moved = moveSelectedStrokes(drawing, ["stroke-1"], 40, 20);
  assert.deepEqual(moved.strokes[0].points, [{ x: 50, y: 30 }, { x: 140, y: 120 }]);
  assert.deepEqual(moved.strokes[1].points, outside.points);
  assert.deepEqual(drawing.strokes[0].points, stroke.points);
});

test("選択した手書きはキャンバスの外へ移動しない", () => {
  const drawing = { version: 1, date: "2026-07-19", strokes: [stroke] };
  const moved = moveSelectedStrokes(drawing, ["stroke-1"], -1000, -1000);
  assert.deepEqual(moved.strokes[0].points, [{ x: 0, y: 0 }, { x: 90, y: 90 }]);
});

test("選んだ手書きだけを削除し、元のデータは変更しない", () => {
  const outside = { ...stroke, id: "outside", points: [{ x: 500, y: 500 }, { x: 600, y: 600 }] };
  const drawing = { version: 1, date: "2026-07-19", strokes: [stroke, outside] };
  const deleted = deleteSelectedStrokes(drawing, ["stroke-1"]);
  assert.deepEqual(deleted.strokes, [outside]);
  assert.deepEqual(drawing.strokes, [stroke, outside]);
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
