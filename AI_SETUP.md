# AI手書き認識の無料セットアップ

Study Canvasは、利用者が囲んだ手書き画像だけをGemini 2.5 Flashへ送り、科目・勉強内容・予定時間の候補を返します。AI候補はフォームへ入るだけで、確認して「タスクを追加」を押すまで保存しません。

## 費用を発生させない条件

- Gemini APIでは請求先を登録しない。
- CloudflareはFreeプランのまま利用する。
- `cloudflare-worker.js`のモデル名`gemini-2.5-flash`を変更しない。
- 上限超過時はエラーで停止し、有料モデルへの切替や自動再試行を行わない。
- 無料枠と利用条件は変更される可能性があるため、設定時に各管理画面の料金表示を確認する。

## 1. Gemini APIキー

1. Google AI StudioでAPIキーを作成する。
2. 請求先を登録しない。
3. APIキーはStudy CanvasやGitHubへ貼らず、Cloudflare Secretだけに保存する。

## 2. Cloudflare Worker

1. Cloudflare DashboardのWorkers & Pagesを開く。
2. FreeプランでWorkerを作成する。
3. Workerのコードを、このリポジトリの`cloudflare-worker.js`へ置き換えて公開する。
4. WorkerのSettingsで次を登録する。

| 名前 | 種類 | 値 |
| --- | --- | --- |
| `GEMINI_API_KEY` | Secret | Google AI Studioで作ったAPIキー |
| `ACCESS_TOKEN` | Secret | Study CanvasのAI設定で「生成」を押して作った値 |
| `ALLOWED_ORIGIN` | Text | `https://soutarounaka1016-max.github.io` |

5. 公開後の`https://...workers.dev` URLをコピーする。

`wrangler`を使える環境では`wrangler.jsonc`も利用できます。iPadではCloudflareのWeb編集画面へコードを貼る方法が簡単です。

## 3. Study Canvas

1. 手書きの「タスク化」で範囲を囲む。
2. 「AI設定」を開く。
3. Worker URLと`ACCESS_TOKEN`と同じ値を入力する。
4. 外部送信の確認欄をオンにする。
5. 「接続テスト」を押し、`gemini-2.5-flash`と「自動の有料モデル切替: なし」が表示されることを確認する。
6. 「AIで読み取る（無料枠）」を押し、候補を確認してからタスクへ追加する。

## 送信範囲とデータ

- ボタンを押した時だけ送信する。
- 送信するのは囲んだPNG画像だけ。
- ページ全体、他の日の計画、タスク一覧、週間目標全体、自由ノート全体は送らない。
- Gemini無料枠では、送信内容がGoogleのサービス改善に使われる場合がある。氏名、学校名、連絡先などを含む範囲は送らない。
- Workerは画像を保存せず、応答へ`Cache-Control: no-store`を付ける。

## 問題が起きた場合

- 「無料枠の上限」: 時間を置いて再度試す。課金や有料モデルへは切り替えない。
- 「設定を確認」: Worker URLと両方の`ACCESS_TOKEN`が同じか確認する。
- 「許可されていない公開元」: `ALLOWED_ORIGIN`が上記URLと一致しているか確認する。
- APIキーが漏れた疑い: Google AI Studioでキーを無効化し、新しいキーをCloudflare Secretへ登録する。
