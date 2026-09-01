/**
 * Timeline の正規化モデル。
 *
 * 各プラットフォームの API レスポンスは source ごとの adapter が
 * TimelineEntry へ写す。UI は TimelineEntry しか知らない。
 */

export const PLATFORMS = [
  'zenn',
  'qiita',
  'devto',
  'medium',
  'github',
  'speakerdeck',
  'codesandbox',
  'codepen',
  'connpass',
  'spotify',
  'x',
] as const;

export type Platform = (typeof PLATFORMS)[number];

/** エントリの種別。表示する動詞と情報の選択がこれで決まる。 */
export type EntryKind =
  | 'article'
  | 'repository'
  | 'talk'
  | 'sandbox'
  | 'event'
  | 'playlist'
  | 'post';

/** エントリに添える数値。プラットフォームごとに意味が違うため label を持たせる。 */
export interface EntryMetric {
  label: string;
  value: number;
}

export interface TimelineEntry {
  /** `${platform}:${プラットフォーム内の識別子}` */
  id: string;
  kind: EntryKind;
  platform: Platform;
  title: string;
  /** 取得元へ直接リンクする（ADR-0016: 外部 activity は synsk.me 上に URL を持たない） */
  url: string;
  /** ISO 8601。ソート順の唯一の根拠。 */
  publishedAt: string;
  summary?: string;
  thumbnailUrl?: string;
  /** oEmbed が返す iframe の src。埋め込みを行う種別だけが持つ。 */
  embedUrl?: string;
  metrics?: EntryMetric[];
  tags?: string[];
}

/**
 * source の取得結果。
 *
 * - `ok`: 実 API から取得した
 * - `unconfigured`: 認証情報が無いため取得を試みていない。`requiredEnv` を満たせば `ok` になりうる
 * - `unavailable`: 取得手段が存在しない。設定では変わらない
 * - `error`: 取得を試みて失敗した
 */
export type SourceStatus = 'ok' | 'unconfigured' | 'unavailable' | 'error';

export interface SourceResult {
  platform: Platform;
  status: SourceStatus;
  entries: TimelineEntry[];
  /** status の根拠。UI に表示し、検証結果をページ上で読めるようにする。 */
  note: string;
  /** status の根拠となる公式ドキュメントの URL。 */
  reference?: string;
  /** 値をセットすれば `ok` に変わる環境変数名。 */
  requiredEnv?: string[];
}

export interface TimelineSource {
  platform: Platform;
  label: string;
  fetch: () => Promise<SourceResult>;
}
