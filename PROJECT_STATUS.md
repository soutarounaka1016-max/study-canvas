# PROJECT_STATUS

更新日: 2026-07-20

## 現在の状態

Study Canvasは、日別の手書き計画、タスクカード、週間目標、自由ノートをまとめて使えるiPad Safari向け受験勉強管理Webアプリです。

Pull Request #27から#30までの機能は`main`へマージ済みで、利用者がiPad Safariで確認しました。現在は、選択した手書きをGemini無料枠で読み取る機能のコードを実装し、外部サービスの設定待ちです。

## 実装済み・利用者確認済み

- 日付別手書き、月間カレンダー、自動保存
- Apple Pencil・一本指描画、二本指移動・拡大縮小
- 日別計画、週間目標、自由ノートの投げ縄選択
- 選択した手書きの移動、拡大縮小、削除
- 日付別タスクカードの追加、編集、完了、削除、自由配置
- 前日の未完了タスクを選んで今日へ繰り越す機能
- 選択した手書き範囲のプレビューと手動タスク化
- 今日やることダッシュボード
- 複数ページ自由ノートとサムネイル一覧
- 全データの統合バックアップ、項目別復元、失敗時ロールバック

## AI手書き認識

### 実装済み・自動テスト対象

- AIサービス: Google Gemini 2.5 Flash
- 中継: Cloudflare Worker Free
- Gemini APIキーをGitHub Pagesへ置かない構成
- Worker URLと専用アクセストークンを端末内へ保存
- 利用者が囲んだPNG画像だけを、ボタンを押した時に送信
- 科目、勉強内容、予定時間、信頼度、警告を構造化JSONで受信
- AI候補をフォームへ入れ、利用者が確認してからタスクを保存
- 無料枠超過時は停止し、有料モデルへの切替や自動再試行を行わない
- 公開元の制限、アクセストークン確認、画像容量制限
- Gemini無料枠のデータ利用に関する確認欄
- 接続テストと端末内AI設定の削除
- セットアップ手順: `AI_SETUP.md`

### 未完了

- Google AI StudioでのAPIキー作成
- CloudflareアカウントでのWorker作成とSecret登録
- 公開Worker URLをStudy Canvasへ設定
- 実際のGemini無料枠との接続テスト
- iPad SafariでのAI読み取り精度・操作確認

これらは外部アカウント、秘密情報、利用規約への同意が必要なため、利用者の操作前には完了できません。

## AIのデータ境界

- 送信するのは囲んだ手書き画像だけです。
- 日別ページ全体、他の日の計画、タスク一覧、週間目標全体、自由ノート全体は送信しません。
- AIは週間目標から今日の予定を自動生成しません。
- AIは利用者の確認なしにタスクを保存しません。
- APIキーはCloudflare Secretだけに置きます。

## 保存領域

- 日別手書き: `study-canvas:pages:v2`
- 旧手書き: `study-canvas:drawing:v1`
- 日付別タスク: `study-canvas:tasks:v1`
- 週間目標: `study-canvas:weekly:v1`
- 自由ノート: `study-canvas:free-note:v1`内のversion 2形式
- AI接続設定: `study-canvas:ai:v1`

AI設定の追加で、既存の手書き・タスク・週間目標・自由ノートの保存形式は変更していません。

## 公開先

- リポジトリ: `soutarounaka1016-max/study-canvas`
- 正式ブランチ: `main`
- 公開URL: `https://soutarounaka1016-max.github.io/study-canvas/`
