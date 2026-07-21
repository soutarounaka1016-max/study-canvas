import test from "node:test";
import assert from "node:assert/strict";

import {
  HOME_ROUTES,
  homeRouteHash,
  normalizeHomeRoute,
} from "../src/home-route.js";

test("空または不明なハッシュはホームへ戻す", () => {
  assert.equal(normalizeHomeRoute(""), "home");
  assert.equal(normalizeHomeRoute("#unknown"), "home");
  assert.equal(normalizeHomeRoute(null), "home");
});

test("主要画面のハッシュを正規化する", () => {
  for (const route of HOME_ROUTES) {
    assert.equal(normalizeHomeRoute(`#${route}`), route);
    assert.equal(homeRouteHash(route), `#${route}`);
  }
});

test("大文字や前後の空白を安全に処理する", () => {
  assert.equal(normalizeHomeRoute(" #WEEKLY "), "weekly");
  assert.equal(normalizeHomeRoute(" notes "), "notes");
});
