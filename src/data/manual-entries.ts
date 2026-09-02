/**
 * 一覧取得の手段が無いプラットフォームの掲載対象。
 *
 * Spotify / CodeSandbox / CodePen / X は、いずれも「自分のコンテンツ一覧」を返す
 * 経路が無い（各 source のコメントに根拠を書いた）。掲載するものをここで指名する。
 *
 * `registeredAt` は**このファイルへ登録した日**であり、コンテンツの公開日ではない。
 * 公開日が判明したものは `publishedAt` を持ち、並び順はそちらを使う。
 */

export interface ManualRef {
  /** 取得元 URL。oEmbed やメタデータの取得キーになる。 */
  url: string;
  /** ISO 8601。このファイルへ登録した日。publishedAt が無いときの並び順に使う。 */
  registeredAt: string;
  /**
   * ISO 8601。公開日が判明しているものだけが持つ。
   * 並び順はこちらを優先する。
   */
  publishedAt?: string;
}

/** oEmbed でタイトルとジャケット画像が取れる。プレイリスト単位で指名する。 */
export const SPOTIFY_PLAYLISTS: ManualRef[] = [
  {
    url: 'https://open.spotify.com/playlist/3yLGcn1xFSeBypkFlWfeqj',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
  {
    url: 'https://open.spotify.com/playlist/05CpNPOk81K5GjS9x1hNz4',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
];

/**
 * `docs/archive/content-analysis/05-codesandbox-analysis.md` に記録された sandbox。
 * `https://codesandbox.io/embed/<id>` は存在しない ID でも 200 を返すため、
 * og:title がサイト既定値のものは取り込まない（source 側で判定する）。
 *
 * OG メタは日付を返さないため、他の手動登録と同じく registeredAt を持たせる。
 */
export interface SandboxRef extends ManualRef {
  /** codesandbox.io の sandbox ID。url はこれを埋めて組み立てる。 */
  id: string;
}

export const CODESANDBOX_SANDBOXES: SandboxRef[] = [
  { id: '2u1kz', url: 'https://codesandbox.io/s/2u1kz', registeredAt: '2026-09-02T00:00:00.000Z' },
  {
    id: 'smolt0',
    url: 'https://codesandbox.io/s/smolt0',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
  { id: '26ghy', url: 'https://codesandbox.io/s/26ghy', registeredAt: '2026-09-02T00:00:00.000Z' },
  { id: '1xlol', url: 'https://codesandbox.io/s/1xlol', registeredAt: '2026-09-02T00:00:00.000Z' },
];

/**
 * CodePen の pen。
 *
 * codepen.io はサーバ側からの取得を Cloudflare の bot challenge で
 * 全経路 403 にするため、題も一覧も取れない。一方、埋め込み iframe は
 * 閲覧者のブラウザが直接読むので描画される。題はブラウザで確認した値。
 */
export interface PenRef extends ManualRef {
  /** codepen.io の pen ID。埋め込み URL をこれで組み立てる。 */
  id: string;
  title: string;
}

export const CODEPEN_PENS: PenRef[] = [
  {
    id: 'LYwzYEE',
    title: 'フォーカスで表示・非表示',
    url: 'https://codepen.io/ksyunnnn/pen/LYwzYEE',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
  {
    id: 'oNoMVNB',
    title: '2 列レイアウト',
    url: 'https://codepen.io/ksyunnnn/pen/oNoMVNB',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
  {
    id: 'QWOBdPj',
    title: 'アニメーション・下から上へ',
    url: 'https://codepen.io/ksyunnnn/pen/QWOBdPj',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
  {
    id: 'qyOZWe',
    title: 'BookList',
    url: 'https://codepen.io/ksyunnnn/pen/qyOZWe',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
];

/**
 * 掲載する投稿。
 *
 * X は無料で一覧を取得できず、oEmbed も個別投稿の指定に限られるため、ここに並べる。
 * 選んだのは Zenn と Qiita の記事本文に本人が埋め込んだ投稿と、
 * 2026-09-02 に oEmbed で本人（author_name: こばしゅん）と確認できたもの。
 * publishedAt は同じ oEmbed のレスポンスから読んだ値。
 */
export const X_POSTS: ManualRef[] = [
  {
    url: 'https://twitter.com/ksyunnnn/status/2019011393044058438',
    publishedAt: '2026-02-04T00:00:00.000Z',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
  {
    url: 'https://twitter.com/ksyunnnn/status/1891642492484731147',
    publishedAt: '2025-02-18T00:00:00.000Z',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
  {
    url: 'https://twitter.com/ksyunnnn/status/1850757894746358123',
    publishedAt: '2024-10-28T00:00:00.000Z',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
  {
    url: 'https://twitter.com/ksyunnnn/status/1814576380845150411',
    publishedAt: '2024-07-20T00:00:00.000Z',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
  {
    url: 'https://twitter.com/ksyunnnn/status/1712422086491431275',
    publishedAt: '2023-10-12T00:00:00.000Z',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
  {
    url: 'https://twitter.com/ksyunnnn/status/1179354779589513218',
    publishedAt: '2019-10-02T00:00:00.000Z',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
  {
    url: 'https://twitter.com/ksyunnnn/status/958664234350518272',
    publishedAt: '2018-01-31T00:00:00.000Z',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
  {
    url: 'https://twitter.com/ksyunnnn/status/865812339072802816',
    publishedAt: '2017-05-20T00:00:00.000Z',
    registeredAt: '2026-09-02T00:00:00.000Z',
  },
];
