# Cloudflare Workers AI 画像認識

Study Canvasは、科目別の週間目標キャンバスをPNG画像にし、Cloudflare Worker経由でWorkers AIへ送信します。

画像は自動送信されません。週間目標の「読み取り確認」を開き、利用者が「AIで読み取る」を押した時だけ送信します。AIの候補は未確定のまま表示され、内容を修正し、選択した候補だけを週間カードとして保存します。

## 現在の構成

```text
Study Canvas（GitHub Pages）
  ↓ PNG・科目・対象週
study-canvas Worker
  ↓ AI binding
Cloudflare Workers AI
  ↓ 複数タスクのJSON
確認・修正画面
  ↓ 利用者が確定
週間カード保存
```

- Worker URL: `https://study-canvas.soutarou-naka-1016.workers.dev`
- Worker名: `study-canvas`
- Workers AI binding名: `AI`
- 利用モデル: `@cf/meta/llama-3.2-11b-vision-instruct`
- 許可する公開元: `https://soutarounaka1016-max.github.io`

## Cloudflare側の設定

WorkerのSettings → Bindingsで、Workers AI bindingを追加します。

| 名前 | 種類 |
| --- | --- |
| `AI` | Workers AI |

`wrangler.jsonc`にも同じ設定を記録しています。

```json
{
  "name": "study-canvas",
  "main": "cloudflare-worker.js",
  "ai": {
    "binding": "AI"
  },
  "vars": {
    "ALLOWED_ORIGIN": "https://soutarounaka1016-max.github.io"
  }
}
```

Google AI StudioのAPIキー、Gemini APIキー、Cloudflareの`ACCESS_TOKEN`は週間目標の読み取りには使用しません。秘密情報をGitHub Pagesへ埋め込まない構成です。

## GitHubからのデプロイ

Cloudflare WorkerをこのGitHubリポジトリへ接続し、mainブランチの更新時にデプロイします。

デプロイ対象は次のファイルです。

- `cloudflare-worker.js`
- `wrangler.jsonc`

Workerのルートディレクトリはリポジトリのルートです。ビルドコマンドは不要で、デプロイコマンドはCloudflareのGit連携設定に従います。

## 送信する内容

週間読み取りで送るのは次だけです。

- 現在開いている1科目分の週間目標PNG
- 科目名
- 対象週の開始日

他の科目、日別キャンバス、自由ノート、保存済みカード、バックアップ内容は送信しません。Workerは画像を保存せず、応答には`Cache-Control: no-store`を付けます。

## 保存と失敗時の動作

- AIの読み取りだけではlocalStorageを変更しません。
- 候補は画面上で修正・選択できます。
- 「選択した候補をカード化」を押した時だけ保存します。
- 通信失敗、タイムアウト、AIの形式不正では既存カードを変更しません。
- localStorageへの保存確認に失敗した場合は以前の値へ戻します。
- 週間カードは統合バックアップへ含めます。

## 無料枠とエラー

Workerは固定したWorkers AIモデルだけを利用し、有料モデルへ自動切替しません。利用上限や一時的な容量不足の場合はエラーを返し、時間を置いて再実行します。

料金や無料枠は変更される可能性があるため、Cloudflare Dashboardで現在の利用状況を確認します。課金設定が必要になる変更は、実施前に利用者の確認を取ります。

## 確認項目

1. `/health`が`ok: true`を返す
2. 数学などの週間キャンバスから画像を送れる
3. 複数候補が表示される
4. 候補を修正・選択できる
5. 選択候補だけ週間カードになる
6. 再読み込み後もカードが残る
7. AI失敗後も保存済みカードが変わらない
8. 統合バックアップで週間カードを保存・復元できる
