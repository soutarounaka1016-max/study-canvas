import assert from "node:assert/strict";
import test from "node:test";

import {
  NOTE_STORAGE_KEY,
  emptyNoteStore,
  getNoteDrawing,
  loadNoteStore,
  replaceStoredNoteStore,
  serializeNoteStore,
  setNoteDrawing,
} from "../src/note-store.js";

const drawing = {
  version: 1,
  date: "free-note",
  strokes: [{ id: "note-1", color: "#2558e6", width: 5, points: [{ x: 12, y: 34 }] }],
};

test("保存値がない場合は空の自由ノートを作る", () => {
  assert.deepEqual(loadNoteStore(null), { store: emptyNoteStore(), recovered: false });
});

test("自由ノートの手書きを保存して読み出せる", () => {
  const store = setNoteDrawing(emptyNoteStore(), drawing);
  assert.equal(getNoteDrawing(store).strokes[0].id, "note-1");
  assert.equal(getNoteDrawing(store).date, "free-note");
});

test("壊れたJSONや別形式は空のノートへ戻す", () => {
  assert.deepEqual(loadNoteStore("not-json"), { store: emptyNoteStore(), recovered: true });
  assert.deepEqual(loadNoteStore(JSON.stringify({ version: 2, drawing })), {
    store: emptyNoteStore(),
    recovered: true,
  });
});

test("不正な手書き線だけを除外して復旧を報告する", () => {
  const raw = JSON.stringify({
    version: 1,
    drawing: {
      ...drawing,
      strokes: [
        drawing.strokes[0],
        { id: "bad", color: "#000", width: 5, points: [{ x: -1, y: 10 }] },
      ],
    },
  });
  const loaded = loadNoteStore(raw);
  assert.equal(loaded.store.drawing.strokes.length, 1);
  assert.equal(loaded.recovered, true);
});

test("直列化した自由ノートを同じ内容で読み戻せる", () => {
  const store = setNoteDrawing(emptyNoteStore(), drawing);
  const loaded = loadNoteStore(serializeNoteStore(store));
  assert.equal(loaded.recovered, false);
  assert.deepEqual(loaded.store, store);
});

test("取得した手書きを変更しても保存元は変わらない", () => {
  const store = setNoteDrawing(emptyNoteStore(), drawing);
  const detached = getNoteDrawing(store);
  detached.strokes[0].points[0].x = 999;
  assert.equal(getNoteDrawing(store).strokes[0].points[0].x, 12);
});

test("保存結果が一致しない場合は以前の自由ノートへ戻す", () => {
  const previousStore = setNoteDrawing(emptyNoteStore(), drawing);
  const nextStore = setNoteDrawing(emptyNoteStore(), {
    ...drawing,
    strokes: [{ ...drawing.strokes[0], id: "note-2" }],
  });
  const previousRaw = serializeNoteStore(previousStore);
  let current = previousRaw;
  let firstWrite = true;
  const storage = {
    getItem(key) {
      assert.equal(key, NOTE_STORAGE_KEY);
      return current;
    },
    setItem(key, value) {
      assert.equal(key, NOTE_STORAGE_KEY);
      if (firstWrite) {
        firstWrite = false;
        current = `${value}broken`;
      } else {
        current = value;
      }
    },
    removeItem() {
      current = null;
    },
  };

  assert.throws(() => replaceStoredNoteStore(storage, NOTE_STORAGE_KEY, nextStore), /確認/);
  assert.equal(current, previousRaw);
});
