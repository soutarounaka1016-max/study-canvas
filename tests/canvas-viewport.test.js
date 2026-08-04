import test from "node:test";
import assert from "node:assert/strict";
import { CanvasViewport, MIN_VIEW_SCALE } from "../src/canvas-viewport.js";

function element(width, height) {
  return {
    clientWidth: width, clientHeight: height, offsetWidth: width, offsetHeight: height,
    dataset: {}, style: {}, classList: { add() {}, remove() {} },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
}

test("用紙は25%まで縮小できる", () => assert.equal(MIN_VIEW_SCALE, 0.25));

test("画面より小さく縮小した用紙を中央へ配置する", () => {
  const container = element(1000, 800);
  const stage = element(1000, 800);
  const viewport = new CanvasViewport(container, stage);
  viewport.scale = 0.25;
  viewport.clampPosition();
  assert.deepEqual({ x: viewport.x, y: viewport.y }, { x: 375, y: 300 });
});
