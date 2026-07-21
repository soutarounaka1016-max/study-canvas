import { replaceStoredNoteStore } from "./src/note-store.js?v=20260720-6";

const NOTE_ROUTE = "#notes";
const noteReady = import("./note-selection-ui.js?v=20260721-2").catch((error) => {
  document.documentElement.dataset.noteLoadError = "true";
  console.error("自由ノートの初期化に失敗しました", error);
  return null;
});

async function openNoteRoute() {
  if (location.hash !== NOTE_ROUTE) return;
  const module = await noteReady;
  if (!module) return;

  const dialog = document.querySelector("#noteDialog");
  const button = document.querySelector("#noteButton");
  if (!dialog || !button) {
    document.documentElement.dataset.noteLoadError = "true";
    console.error("自由ノートを開くための画面部品が見つかりません");
    return;
  }

  if (!dialog.open) button.click();
  if (!dialog.open) {
    document.documentElement.dataset.noteLoadError = "true";
    console.error("自由ノートを開けませんでした");
  }
}

window.addEventListener("hashchange", openNoteRoute);
noteReady.then(openNoteRoute);

export { replaceStoredNoteStore };
export const NOTE_CLEAR_CONFIRMATION_CONTRACT = 'window.confirm("自由ノートを白紙に戻しますか？")';
