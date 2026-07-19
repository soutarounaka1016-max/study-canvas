# PROJECT_STATUS

更新日: 2026-07-19

## 状態

手書きキャンバスMVPをPull Requestで確認中。

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
- 白紙化前の確認
- PR時の自動テストと構成検査
- main更新時のGitHub Pages自動公開ワークフロー

## 動作確認

- 自動テスト: 5件成功
- 静的構成検査: 成功
- ローカル静的サーバー: 主要4ファイルがHTTP 200で取得可能
- GitHub Actions（Pull Request）: 成功
- iPad Safari: 未確認
- GitHub Pages公開画面: 未確認

## 保存データ

キー: `study-canvas:drawing:v1`

現段階では同じSafari内に1ページ分を保存する。Safariのサイトデータを削除すると消える可能性があり、別端末には同期されない。

## 公開状況

mainへのマージ前。GitHub Pagesは未公開。
