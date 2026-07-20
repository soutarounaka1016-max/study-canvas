# Gemini連携（保留中）の旧セットアップ

> 現在の通常導線は、APIキーを使わずブラウザ内で処理する端末内OCRです。Google AI Studioの年齢確認・アカウント条件を正規に満たせないため、このGemini連携は設定せず保留します。年齢や本人確認を回避して利用しないでください。

この文書は、将来利用条件を正規に満たせるようになった場合に再検討するため、旧構成の記録として残しています。

Study Canvasの旧Gemini構成は、利用者が囲んだ手書き画像だけをGemini 2.5 Flashへ送り、科目・勉強内容・予定時間の候補を返します。候補はフォームへ入るだけで、確認して「タスクを追加」を押すまで保存しません。

## 再開前に確認すること

- 利用者本人がサービスの年齢・アカウント条件を正規に満たしている。
- 保護者承認など必要な条件を省略しない。
- Gemini APIの利用規約と無料枠を再確認する。
- 外部へ画像を送る必要性が、端末内OCRより高いと判断できる。
- APIキー、アクセストークン、費用、送信データへの明示的な承認がある。

## 費用を発生させない旧条件

- Gemini APIでは請求先を登録しない。
- CloudflareはFreeプランのまま利用する。
- `cloudflare-worker.js`のモデル名`gemini-2.5-flash`を変更しない。
- 上限超過時はエラーで停止し、有料モデルへの切替や自動再試行を行わない。
- 無料枠と利用条件は変更される可能性があるため、再開時に各管理画面の料金表示を確認する。

## 1. Gemini APIキー

1. Google AI Studioで、利用条件を正規に満たすアカウントからAPIキーを作成する。
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
| `ACCESS_TOKEN` | Secret | Study CanvasのAI設定で生成した値 |
| `ALLOWED_ORIGIN` | Text | `https://soutarounaka1016-max.github.io` |

5. 公開後のWorker URLをStudy Canvasへ設定する。

## 送信範囲とデータ

- ボタンを押した時だけ送信する。
- 送信するのは囲んだPNG画像だけ。
- ページ全体、他の日の計画、タスク一覧、週間目標全体、自由ノート全体は送らない。
- 送信内容が提供元のサービス改善に使われる可能性を、再開時に確認する。
- Workerは画像を保存せず、応答へ`Cache-Control: no-store`を付ける。

## 問題が起きた場合

- 年齢・本人確認・保護者承認で利用できない場合は、回避せず端末内OCRを使う。
- 無料枠の上限に達した場合は停止し、課金や有料モデルへ自動切替しない。
- APIキーが漏れた疑いがある場合はキーを無効化する。
