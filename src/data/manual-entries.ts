/**
 * 一覧取得の手段が無いプラットフォームの掲載対象。
 *
 * Spotify / CodeSandbox / CodePen / X は、いずれも「自分のコンテンツ一覧」を返す
 * 経路が無い（各 source のコメントに根拠を書いた）。掲載するものをここで指名する。
 *
 * `registeredAt` は**このファイルへ登録した日**であり、コンテンツの公開日ではない。
 * 公開日が判明したものから置き換える。
 */

export interface ManualRef {
  /** 取得元 URL。oEmbed やメタデータの取得キーになる。 */
  url: string;
  /** ISO 8601。時系列の並び順に使う。 */
  registeredAt: string;
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
 * 掲載したいツイート。
 * X は無料で一覧を取得できず、oEmbed も個別ツイート指定のため、ここに URL を並べる。
 */
export const X_POSTS: ManualRef[] = [];
