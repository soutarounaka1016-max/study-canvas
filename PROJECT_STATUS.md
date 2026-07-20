# PROJECT_STATUS

更新日: 2026-07-20

## 現在の状態

Study Canvasは、日別の手書き計画、タスクカード、週間目標、自由ノートを備えたiPad Safari向けWebアプリです。

Pull Request #21で次の4項目を実装しました。

- 自由ノートの複数ページ化
- 日別計画・週間目標・自由ノートの二本指移動と拡大縮小
- 今日の日付だけ点灯する「今日」ランプ
- 月間カレンダー形式のページ一覧

最新の自動テストとビルドは成功しています。mainへのマージ、GitHub Pagesへの反映、利用者によるiPad Safari確認はまだ完了していません。

## 実装済み機能

- 青・赤・黒のペンと太さ変更
- ストローク単位の消しゴム
- 閲覧、取り消し、やり直し、自動保存
- 日付別ページと前日・今日・翌日への切り替え
- 月間カレンダー形式のページ一覧と手書きサムネイル
- 投げ縄選択、移動、拡大縮小、選択削除
- Apple Pencilまたは一本指での描画
- 二本指でのキャンバス移動とピンチ拡大縮小
- 日別手書きのJSONバックアップと復元
- 日付別タスクカード
- 週間目標キャンバス
- 複数ページの自由ノート
- 自由ノートの追加、切り替え、確認付き削除

## 保存領域

- 日別手書き: `study-canvas:pages:v2`
- 旧手書き: `study-canvas:drawing:v1`
- 日付別タスク: `study-canvas:tasks:v1`
- 週間目標: `study-canvas:weekly:v1`
- 自由ノート: `study-canvas:free-note:v1`内のversion 2形式

保存領域は分離しています。現在のJSONバックアップは日別手書き専用で、タスクカード、週間目標、自由ノートは含みません。

## 確認状態

- Pull Request #21の自動テスト: 成功
- Pull Request #21のビルド: 成功
- mainとのコンフリクト: なし
- 4項目の公開画面確認: 未確認
- 4項目のiPad Safari確認: 未確認
- Apple Pencilと二本指操作の実機確認: 未確認

## 公開先

- リポジトリ: `soutarounaka1016-max/study-canvas`
- 正式ブランチ: `main`
- 公開URL: `https://soutarounaka1016-max.github.io/study-canvas/`
