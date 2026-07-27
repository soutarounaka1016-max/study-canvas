import test from "node:test";
import assert from "node:assert/strict";
import {
  WEEKLY_CARD_STORAGE_KEY,
  addWeeklyCards,
  deleteWeeklyCard,
  emptyWeeklyCardStore,
  getWeeklyCards,
  loadWeeklyCardStore,
  replaceStoredWeeklyCardStore,
  serializeWeeklyCardStore,
} from "../src/weekly-card-store.js";

const monday = "2026-07-27";
const card = { id: "c1", title: "1対1対応 微積を5問", confidence: 0.9, warning: "", createdAt: "2026-07-27T00:00:00.000Z", source: "ai" };

test("週と科目ごとにカードを保存する", () => {
  let store = addWeeklyCards(emptyWeeklyCardStore(), monday, "数学", [card]);
  store = addWeeklyCards(store, monday, "英語", [{ ...card, id: "e1", title: "長文1題" }]);
  assert.equal(getWeeklyCards(store, monday, "数学")[0].title, card.title);
  assert.equal(getWeeklyCards(store, monday, "英語")[0].title, "長文1題");
});

test("直列化後もカードが残る", () => {
  const store = addWeeklyCards(emptyWeeklyCardStore(), monday, "数学", [card]);
  const loaded = loadWeeklyCardStore(serializeWeeklyCardStore(store));
  assert.equal(loaded.recovered, false);
  assert.deepEqual(getWeeklyCards(loaded.store, monday, "数学"), [card]);
});

test("削除対象以外のカードを保持する", () => {
  let store = addWeeklyCards(emptyWeeklyCardStore(), monday, "数学", [card, { ...card, id: "c2", title: "ベクトル復習" }]);
  store = deleteWeeklyCard(store, monday, "数学", "c1");
  assert.deepEqual(getWeeklyCards(store, monday, "数学").map((item) => item.id), ["c2"]);
});

test("保存失敗時は以前の値へ戻す", () => {
  const previous = addWeeklyCards(emptyWeeklyCardStore(), monday, "数学", [card]);
  const next = addWeeklyCards(previous, monday, "数学", [{ ...card, id: "c2" }]);
  let current = serializeWeeklyCardStore(previous);
  let first = true;
  const storage = {
    getItem(key) { assert.equal(key, WEEKLY_CARD_STORAGE_KEY); return current; },
    setItem(key, value) { assert.equal(key, WEEKLY_CARD_STORAGE_KEY); current = first ? `${value}broken` : value; first = false; },
    removeItem() { current = null; },
  };
  assert.throws(() => replaceStoredWeeklyCardStore(storage, WEEKLY_CARD_STORAGE_KEY, next), /確認/);
  assert.equal(current, serializeWeeklyCardStore(previous));
});
