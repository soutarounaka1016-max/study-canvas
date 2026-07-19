import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("不要と決めた指す・文字入力をツールバーに表示しない", () => {
  assert.doesNotMatch(html, /指す（今後追加）/);
  assert.doesNotMatch(html, /文字入力（今後追加）/);
});

test("青・赤・黒とペンの太さ調整を維持する", () => {
  assert.match(html, /aria-label="青"/);
  assert.match(html, /aria-label="赤"/);
  assert.match(html, /aria-label="黒"/);
  assert.match(html, /id="penWidth"[^>]*type="range"/);
});
