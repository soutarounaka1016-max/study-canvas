import assert from "node:assert/strict";
import test from "node:test";
import {
  createNote, emptyNoteStore, getNote, listNotes, parseNoteStore, serializeNoteStore, setNoteDrawing,
} from "../src/note-store.js";

const stroke = { id: "s1", color: "#2558e6", width: 5, points: [{ x: 1, y: 2 }] };

test("自由ノートを作成して新しい順に一覧表示する", () => {
  let store = createNote(emptyNoteStore(), "one", "模試の反省", "2026-07-19T00:00:00.000Z");
  store = createNote(store, "two", "長期計画", "2026-07-20T00:00:00.000Z");
  assert.deepEqual(listNotes(store).map(({ title }) => title), ["長期計画", "模試の反省"]);
});

test("ノートごとの手書きを別々に保存する", () => {
  const initial = createNote(emptyNoteStore(), "one", "模試の反省");
  const updated = setNoteDrawing(initial, "one", { version: 1, date: "", strokes: [stroke] });
  assert.deepEqual(getNote(updated, "one").drawing.strokes, [stroke]);
  assert.deepEqual(getNote(initial, "one").drawing.strokes, []);
});

test("保存と読み込みでノートが残る", () => {
  const store = createNote(emptyNoteStore(), "one", "模試の反省", "2026-07-20T00:00:00.000Z");
  assert.equal(parseNoteStore(serializeNoteStore(store)).notes.one.title, "模試の反省");
});

test("壊れたノートデータを拒否する", () => {
  assert.equal(parseNoteStore("{broken"), null);
  assert.equal(parseNoteStore(JSON.stringify({ version: 99, order: [], notes: {} })), null);
});
