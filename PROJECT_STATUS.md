# PROJECT_STATUS

更新日: 2026-07-19

## 状態

手書きキャンバスMVPをmainへマージし、GitHub Pagesで公開済み。

## 目的

白いキャンバスに1日分の勉強計画を自由に手書きし、後からタスクとして管理できるアプリを目指す。最重要価値は、今日何をするか決めること。

## 技術

- HTML / CSS / JavaScript
- Canvas API / Pointer Events
- localStorage
- GitHub Actions
- GitHub Pages
- 外部ライブラリ、バックエンド、APIキーなし

## 今回実装したMVP

- iPad横向きを想定した白い3:2キャンバス
- メタ文字で慣れている配置を参考にした上部ツールバー
- 青・赤・黒のペン
- ペンの太さ変更
- ストローク単位の消しゴム
- 閲覧モード
- 取り消し・やり直し
- localStorageへの自動保存
- ページ再読み込み後の手書き復元
- 日付ごとに1枚のキャンバスを保存
- 前日・今日・翌日のページ切り替え
- 手書きがある日を新しい順で表示するページ一覧とサムネイル
- iPad Safariのダブルタップ拡大を防止
- 旧v1データを残したままv2へ安全に移行
- 白紙化前の確認
- PR時の自動テストと構成検査
- main更新時のGitHub Pages自動公開ワークフロー
- 公開後に最新のCSSとJavaScriptを確実に読み込むバージョン指定

## 動作確認

- 自動テスト: 17件成功
- 静的構成検査: 成功
- ローカル静的サーバー: 主要4ファイルがHTTP 200で取得可能
- GitHub Actions（Pull Request）: 成功
- GitHub Pages公開画面: 正常表示
- 公開後の手書き・自動保存・再読み込み復元・取り消し・やり直し: 成功
- 公開後のv1→v2移行・日付切り替え・日付別保存: 成功
- アプリ本体由来の重大なコンソールエラー: なし
- iPad Safari横向き: ユーザー画面でペン入力を確認
- Apple Pencil: 未確認
- ダブルタップ拡大防止: iPad Safari実機で確認済み

## 保存データ

現在のキー: `study-canvas:pages:v2`

移行前データのキー: `study-canvas:drawing:v1`（安全のため削除せず保持）

同じSafari内で日付ごとに1ページを保存する。Safariのサイトデータを削除すると消える可能性があり、別端末には同期されない。

## 公開状況

公開済み: https://soutarounaka1016-max.github.io/study-canvas/

GitHub Pagesの初回設定は完了済み。今後はmain更新時に自動テスト後、自動公開する。
