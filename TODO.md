# TODO

更新日: 2026-07-20

## 完了済み

- [x] 日別手書きキャンバス
- [x] 日付別ページ管理と月間カレンダー
- [x] 投げ縄選択・移動・拡大縮小・削除
- [x] 日別手書きのJSONバックアップと復元
- [x] 日付別タスクカード
- [x] 週間目標キャンバス
- [x] 自由ノートの複数ページ化
- [x] 日別・週間目標・自由ノートの二本指移動と拡大縮小
- [x] 今日の日付だけ点灯する「今日」ランプ
- [x] Pull Request #21の公開と利用者実機確認
- [x] 自由ノートをサムネイル一覧から選ぶ形式へ変更
- [x] 自由ノート名の編集と更新日時表示
- [x] Pull Request #22の公開と利用者実機確認
- [x] キャンバス上へタスクカードを表示
- [x] タスクカードの追加・編集・完了切り替え
- [x] タスクカードのドラッグ移動と日付別位置保存
- [x] Pull Request #24の自動テストとビルド

## 公開前

- [ ] Pull Request #24をmainへマージする
- [ ] GitHub Pagesへの反映を確認する

## iPad Safariで確認する項目

- [ ] タスク追加後、キャンバス上にカードが表示される
- [ ] カード左側のハンドルで位置を移動できる
- [ ] 再読み込み後もカード位置が残る
- [ ] カード上のチェックで完了・未完了を切り替えられる
- [ ] カード本文を押して編集できる
- [ ] 日付を変えると、その日のカードだけが表示される
- [ ] カード操作中に手書き線が増えない
- [ ] 既存の手書き、二本指操作、タスク一覧が引き続き使える

## 今後の候補

- [ ] タスクカード、週間目標、自由ノートを含む統合バックアップ方式を検討する
- [ ] 選択した手書き範囲のAIタスク変換を検討する

## 制約

- localStorageはSafariのサイトデータ削除で消える可能性がある。
- 現在のJSONバックアップは日別手書き専用である。
- iPad SafariとApple Pencilの最終操作確認は利用者が行う。

## Latest verified status

- [x] Pull Request #24 was merged, published, and confirmed by the user on iPad Safari.
- [x] Previous-day unfinished task carryover was implemented in Pull Request #25.
- [x] Carryover unit tests passed.
- [x] The full test suite and build passed for Pull Request #25.
- [x] Pull Request #25 was merged into main.
- [ ] Confirm GitHub Pages reflects the carryover assets.
- [ ] Confirm the carryover flow on the published iPad Safari app.
