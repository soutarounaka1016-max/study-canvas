import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../note.css", import.meta.url), "utf8");
const ui = await readFile(new URL("../note-ui.js", import.meta.url), "utf8");
const store = await readFile(new URL("../src/note-store.js", import.meta.url), "utf8");

test("自由ノートをサムネイル一覧から選べる", () => {
  assert.match(html, /id="noteGalleryView"/);
  assert.match(html, /id="noteGallery"/);
  assert.match(html, /id="createNoteCardButton"/);
  assert.match(html, /新規ノート作成/);
  assert.match(ui, /renderGallery/);
  assert.match(ui, /drawThumbnail/);
  assert.match(css, /\.note-gallery-card/);
});

test("一覧から選択したノートだけを編集画面で開く", () => {
  assert.match(html, /id="noteEditorView"[^>]*hidden/);
  assert.match(html, /id="backToNoteGalleryButton"/);
  assert.match(ui, /showEditor\(page\.id\)/);
  assert.match(ui, /setActiveNotePage/);
});

test("自由ノートへ名前を付けて保存できる", () => {
  assert.match(html, /id="noteTitleInput"[^>]*maxlength="40"/);
  assert.match(ui, /renameNotePage/);
  assert.match(store, /export function renameNotePage/);
});

test("一覧にはノート名と更新日時を表示する", () => {
  assert.match(ui, /updated\.dateTime = page\.updatedAt/);
  assert.match(ui, /formatDate\(page\.updatedAt\)/);
  assert.match(css, /\.note-gallery-card time/);
});
