import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const selectionDom = await readFile(new URL("../src/selection-dom.js", import.meta.url), "utf8");
const entry = await readFile(new URL("../taskize-entry.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../taskize-ui.js", import.meta.url), "utf8");
const css = await readFile(new URL("../taskize.css", import.meta.url), "utf8");

test("loads taskization assets", () => {
  assert.match(selectionDom, /taskize-entry\.js/);
  assert.match(entry, /taskize\.css/);
  assert.match(entry, /taskize-ui\.js/);
  assert.match(css, /\.taskize-lasso-canvas/);
});

test("supports all three canvases", () => {
  assert.match(ui, /key: "daily"/);
  assert.match(ui, /key: "weekly"/);
  assert.match(ui, /key: "note"/);
  assert.match(ui, /replaceStoredTaskStore/);
  assert.doesNotMatch(ui, /fetch\s*\(/);
});
