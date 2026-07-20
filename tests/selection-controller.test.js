import test from "node:test";
import assert from "node:assert/strict";
import { SelectionController } from "../src/selection-controller.js";

function setup() {
  let drawing = {
    version: 1,
    date: "2026-07-20",
    strokes: [{
      id: "s1",
      color: "#2558e6",
      width: 5,
      points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
    }],
  };
  const controller = new SelectionController(
    () => drawing,
    (next) => { drawing = next; },
  );
  return { controller, read: () => drawing };
}

test("select and move", () => {
  const state = setup();
  state.controller.begin({ x: 50, y: 50 });
  state.controller.move({ x: 250, y: 50 });
  state.controller.move({ x: 250, y: 250 });
  state.controller.move({ x: 50, y: 250 });
  state.controller.end();
  assert.deepEqual([...state.controller.selectedIds], ["s1"]);
  state.controller.begin({ x: 150, y: 150 });
  state.controller.move({ x: 180, y: 170 });
  assert.equal(state.controller.end(), true);
  assert.deepEqual(state.read().strokes[0].points, [{ x: 130, y: 120 }, { x: 230, y: 220 }]);
});

test("delete selected", () => {
  const state = setup();
  state.controller.selectedIds = new Set(["s1"]);
  assert.equal(state.controller.deleteSelected(), true);
  assert.equal(state.read().strokes.length, 0);
});
