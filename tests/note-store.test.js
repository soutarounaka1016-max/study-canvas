import assert from "node:assert/strict";
import test from "node:test";

import {
  NOTE_STORAGE_KEY,
  NOTE_STORE_VERSION,
  addNotePage,
  deleteNotePage,
  emptyNoteStore,
  getNoteDrawing,
  listNotePages,
  loadNoteStore,
  renameNotePage,
  replaceStoredNoteStore,
  serializeNoteStore,
  setActiveNotePage,
  setNoteDrawing,
} from "../src/note-store.js";

function drawing(id, x = 12) {
  return {
    version: 1,
    date: id,
    strokes: [{ id: `${id}-stroke`, color: "#2558e6", width: 5, points: [{ x, y: 34 }] }],
  };
}

test("保存値がない場合は最初の自由ノートページを作る", () => {
  const loaded = loadNoteStore(null);
  assert.equal(loaded.recovered, false);
  assert.equal(loaded.migrated, false);
  assert.equal(loaded.store.version, NOTE_STORE_VERSION);
  assert.equal(loaded.store.pages.length, 1);
  assert.equal(loaded.store.activePageId, loaded.store.pages[0].id);
});

test("旧1ページ形式を最初のページへ移行する", () => {
  const oldDrawing = drawing("free-note");
  const loaded = loadNoteStore(JSON.stringify({ version: 1, drawing: oldDrawing }));
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.store.pages.length, 1);
  assert.equal(getNoteDrawing(loaded.store).strokes[0].id, "free-note-stroke");
});

test("複数ページを追加して別々の手書きを保存できる", () => {
  let store = emptyNoteStore();
  const firstId = store.activePageId;
  store = setNoteDrawing(store, drawing(firstId, 10), firstId);
  store = addNotePage(store);
  const secondId = store.activePageId;
  store = setNoteDrawing(store, drawing(secondId, 20), secondId);

  assert.equal(listNotePages(store).length, 2);
  assert.equal(getNoteDrawing(store, firstId).strokes[0].points[0].x, 10);
  assert.equal(getNoteDrawing(store, secondId).strokes[0].points[0].x, 20);
});

test("自由ノートへ名前を付けられる", () => {
  let store = emptyNoteStore();
  const pageId = store.activePageId;
  store = renameNotePage(store, pageId, "  模試の反省  ");
  assert.equal(listNotePages(store)[0].title, "模試の反省");
  store = renameNotePage(store, pageId, "");
  assert.equal(listNotePages(store)[0].title, "ノート 1");
  assert.throws(() => renameNotePage(store, "missing", "数学"), /見つかりません/);
});

test("表示する自由ノートページを切り替えられる", () => {
  let store = emptyNoteStore();
  const firstId = store.activePageId;
  store = addNotePage(store);
  store = setActiveNotePage(store, firstId);
  assert.equal(store.activePageId, firstId);
  assert.throws(() => setActiveNotePage(store, "missing"), /見つかりません/);
});

test("複数ページがある場合だけページを削除する", () => {
  let store = emptyNoteStore();
  const firstId = store.activePageId;
  store = addNotePage(store);
  const secondId = store.activePageId;
  store = deleteNotePage(store, secondId);
  assert.equal(store.pages.length, 1);
  assert.equal(store.activePageId, firstId);
  assert.equal(deleteNotePage(store, firstId).pages.length, 1);
});

test("壊れたJSONや別形式は空のノートへ戻す", () => {
  assert.equal(loadNoteStore("not-json").recovered, true);
  assert.equal(loadNoteStore(JSON.stringify({ version: 99, pages: [] })).recovered, true);
});

test("不正な手書き線だけを除外して復旧を報告する", () => {
  const raw = JSON.stringify({
    version: 2,
    activePageId: "note-1",
    pages: [{
      id: "note-1",
      title: "ノート 1",
      drawing: {
        ...drawing("note-1"),
        strokes: [
          drawing("note-1").strokes[0],
          { id: "bad", color: "#000", width: 5, points: [{ x: -1, y: 10 }] },
        ],
      },
    }],
  });
  const loaded = loadNoteStore(raw);
  assert.equal(getNoteDrawing(loaded.store).strokes.length, 1);
  assert.equal(loaded.recovered, true);
});

test("直列化した複数ページを同じ内容で読み戻せる", () => {
  let store = emptyNoteStore();
  store = setNoteDrawing(store, drawing(store.activePageId));
  store = addNotePage(store);
  store = renameNotePage(store, store.activePageId, "数学質問");
  const loaded = loadNoteStore(serializeNoteStore(store));
  assert.equal(loaded.recovered, false);
  assert.equal(loaded.migrated, false);
  assert.deepEqual(loaded.store, store);
});

test("取得した手書きを変更しても保存元は変わらない", () => {
  let store = emptyNoteStore();
  store = setNoteDrawing(store, drawing(store.activePageId));
  const detached = getNoteDrawing(store);
  detached.strokes[0].points[0].x = 999;
  assert.equal(getNoteDrawing(store).strokes[0].points[0].x, 12);
});

test("保存結果が一致しない場合は以前の自由ノートへ戻す", () => {
  let previousStore = emptyNoteStore();
  previousStore = setNoteDrawing(previousStore, drawing(previousStore.activePageId));
  const nextStore = addNotePage(previousStore);
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
