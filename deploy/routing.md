# synsk.me のドメイン割り当て

`synsk.me` とそのサブドメインに、どのサイトを出すかの正本。

## 不変条件

### すべてのサイト

- 各サイトは独立したリポジトリで、ビルドとデプロイは各サイトが持つ。設定を足せない凍結した過去の版は、配信設定をこのリポジトリの `deploy/<ドメイン>/` に置く
- サブドメインに出すサイトのリポジトリ名は、ドメイン名と同じにする
- サブドメインを Cloudflare のプロジェクトにつなぐ手順は [cloudflare-runbook.md](./cloudflare-runbook.md) にある

### 過去の版

- `<年>.synsk.me` に出す
- 決まりごとと版ごとのビルド手順は [archives.md](./archives.md) にある

## 割り当て

| URL | 種類 | リポジトリ | Cloudflare のプロジェクト |
|---|---|---|---|
| `synsk.me` | apex | [ksyunnnn/synsk.me](https://github.com/ksyunnnn/synsk.me) | Workers `synsk-me` |
| `2024.synsk.me` | 過去の版 | [ksyunnnn/2024.synsk.me](https://github.com/ksyunnnn/2024.synsk.me) | Workers `synsk-me-2024` |
