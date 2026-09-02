# Sources

> このディレクトリは、外部プラットフォームごとに「何が取れて、何が取れないか」を持つ。

1 プラットフォーム 1 ファイル。実装は `src/lib/timeline/sources/` にある。

## 再現の手順

各ファイルの「経路」の値は、次を実行して得られる。

```
bash scripts/probe-sources.sh
```

出力と記録が食い違ったら、外部側が変わったということ。記録を書き換える。

フィールドの値は、そのファイルの「経路」に書かれたエンドポイントを叩いて確かめられる。

## 様式

3 つの節を持つ。節を増やさない。

### 経路

| 項目 | 何を書くか |
|---|---|
| 状態 | `src/lib/timeline/types.ts` の `SourceStatus` と同じ値を使う |
| 経路 | RSS / REST / oEmbed / HTML og:meta / 手動登録 / なし。複数を使う場合は用途を括弧で添える |
| エンドポイント | 実際に叩いている URL |
| 認証 | 不要 / 任意（環境変数名） / 必須（環境変数名） |
| 公式性 | 公式 / 非公式 |
| レート制限 | 実測値または公式記載。出典を添える |
| 出典 | 公式ドキュメントの URL |
| 件数 | `scripts/probe-sources.sh` の COUNT 列の値。経路が無ければ `—` |
| 実測日 | `scripts/probe-sources.sh` を実行した日。他の値を括弧で足さない |

### フィールド

| 列 | 何を書くか |
|---|---|
| フィールド | レスポンスのキー名 |
| 型 | そのキーの型 |
| 取得 | `常時` / `認証時のみ` / `手動` / `取得不可` の 4 値 |
| 実データ | 実際に返ってきた値。長いものは要約。取得できていない場合は `—` とし、値の出所を節の前に書く |
| 備考 | 空でよい |

`常時` / `認証時のみ` / `取得不可` は Singer の `inclusion`（`available` / `automatic` / `unsupported`）に対応する。`unsupported` は「the field exists in the source data but the tap is unable to provide it」と定義されており、認証が無いために埋まらないフィールドがこれにあたる。`手動` は Singer に対応する値を持たない。取得の経路が無く、人が書き写した値を指す。

### 取れないもの

取得手段が存在しないものを書く。「なぜ」と「出典」を必ず持たせる。無ければ節ごと省く。

### 節の省略

省いてよいのは 2 つの場合に限る。

- 「取れないもの」が空のとき
- 経路が `なし` のとき、「フィールド」を省く

## 出典

- [Singer specification](https://github.com/singer-io/getting-started/blob/master/docs/DISCOVERY_MODE.md)
