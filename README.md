# Study Canvas

受験勉強の計画を、iPadの白いキャンバスに手書きして保存する個人用Webアプリです。

## 現在のMVP

- 青・赤・黒の手書き
- ペンの太さ変更
- ストローク単位の消しゴム
- 取り消し・やり直し
- Safari内への自動保存
- 再読み込み後の復元
- iPad横向きに適した画面
- 全日付の手書きをJSONファイルへバックアップ

## 確認方法

追加のライブラリは不要です。ローカルでは静的Webサーバーで開いてください。

```bash
python3 -m http.server 8000
```

テストと静的検査:

```bash
npm test
npm run build
```

## 開発状況

現在の状態と未実装機能は[PROJECT_STATUS.md](PROJECT_STATUS.md)と[TODO.md](TODO.md)を参照してください。
