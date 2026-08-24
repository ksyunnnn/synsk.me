# synsk.me

小橋俊介のポートフォリオであり、共創の入り口。外部プラットフォームでの発信を集約し、時系列で見せる。

- ビジョン: [docs/VISION.md](./docs/VISION.md)
- 満たすべきこと: [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md)
- 判断の記録: [docs/adr/](./docs/adr/)
- どこに何を書くか: [docs/README.md](./docs/README.md)

## 技術スタック

Next.js 15（App Router）/ TypeScript / Tailwind CSS

## 開発

```bash
npm run dev     # 開発サーバー（http://localhost:3000）
npm run build   # プロダクションビルド
npm run lint    # リンター
```

## 環境変数

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Tag Manager。本番環境でのみ動作する |
