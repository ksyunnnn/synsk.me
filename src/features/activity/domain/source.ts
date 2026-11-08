/**
 * 取得元と、その取り込み方（specs/004-external-activity/spec.md の FR-001〜FR-005、
 * research.md の R3）。
 *
 * 取得元の名前と分類は D1 の `activity_source` が持つ（migrations/0021）。取り込み方・取る先・
 * 後処理はここと `server/sources/` のコードが持ち、D1 に持たない（FR-004）
 */

/** 一覧を取る取得元。並びは取得の枠の順（contracts/fetch.md） */
export const LIST_SOURCES = [
  'zenn_article',
  'qiita_article',
  'devto_article',
  'medium_article',
  'github_repository',
  'speakerdeck_deck',
  'connpass_event',
] as const;

/** オーナーが URL を指名し、システムが題などを取る取得元 */
export const URL_SOURCES = [
  'x_post',
  'spotify_playlist',
  'youtube_video',
  'codesandbox_sandbox',
] as const;

/** オーナーがすべて手で入力する取得元。`unlisted` は登録していないサイト（FR-005） */
export const MANUAL_SOURCES = ['codepen_pen', 'unlisted'] as const;

export type ListSource = (typeof LIST_SOURCES)[number];
export type UrlSource = (typeof URL_SOURCES)[number];
export type ManualSource = (typeof MANUAL_SOURCES)[number];
/** オーナーが管理画面で登録する取得元 */
export type RegisteredSource = UrlSource | ManualSource;
export type ExternalSource = ListSource | RegisteredSource;

export const REGISTERED_SOURCES: readonly RegisteredSource[] = [...URL_SOURCES, ...MANUAL_SOURCES];
export const EXTERNAL_SOURCES: readonly ExternalSource[] = [...LIST_SOURCES, ...REGISTERED_SOURCES];

/** life event の行の `source`（migrations/0004） */
export const LIFE_EVENT_SOURCE = 'life_event';

export type IntakeMode = 'list' | 'url' | 'manual';

const includes = <T extends string>(list: readonly T[], value: string): value is T =>
  (list as readonly string[]).includes(value);

export const isExternalSource = (value: string): value is ExternalSource =>
  includes(EXTERNAL_SOURCES, value);

export const isRegisteredSource = (value: string): value is RegisteredSource =>
  includes(REGISTERED_SOURCES, value);

export const intakeModeOf = (source: ExternalSource): IntakeMode => {
  if (includes(LIST_SOURCES, source)) return 'list';
  return includes(URL_SOURCES, source) ? 'url' : 'manual';
};

/** 管理画面で出す取得元の名前 */
export const SOURCE_LABELS: Record<ExternalSource, string> = {
  zenn_article: 'Zenn',
  qiita_article: 'Qiita',
  devto_article: 'dev.to',
  medium_article: 'Medium',
  github_repository: 'GitHub',
  speakerdeck_deck: 'Speaker Deck',
  connpass_event: 'connpass',
  x_post: 'X',
  spotify_playlist: 'Spotify',
  youtube_video: 'YouTube',
  codesandbox_sandbox: 'CodeSandbox',
  codepen_pen: 'CodePen',
  unlisted: '登録していないサイト',
};

export const INTAKE_MODE_LABELS: Record<IntakeMode, string> = {
  list: '一覧を取る',
  url: 'URL を指名した',
  manual: '手で入力した',
};

/**
 * URL がその取得元のものかを確かめ、取得元での ID を取り出す（research.md の R9）。
 * ID を持たない取得元（登録していないサイト）は ID を null にする。その取得元のものでなければ null
 */
export const parseRegisteredUrl = (
  source: RegisteredSource,
  value: string,
): { url: string; externalId: string | null } | null => {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);

  switch (source) {
    case 'x_post': {
      // https://x.com/<name>/status/<id>
      if (host !== 'x.com' && host !== 'twitter.com') return null;
      const [name, status, id] = segments;
      if (!name || status !== 'status' || !id || !/^\d+$/.test(id)) return null;
      return { url: `https://x.com/${name}/status/${id}`, externalId: id };
    }
    case 'spotify_playlist': {
      // https://open.spotify.com/playlist/<id>
      if (host !== 'open.spotify.com') return null;
      const [kind, id] = segments;
      if (kind !== 'playlist' || !id || !/^[A-Za-z0-9]+$/.test(id)) return null;
      return { url: `https://open.spotify.com/playlist/${id}`, externalId: id };
    }
    case 'youtube_video': {
      // https://www.youtube.com/watch?v=<id> か https://youtu.be/<id>
      const id =
        host === 'youtu.be'
          ? segments[0]
          : host === 'youtube.com' || host === 'm.youtube.com'
            ? url.searchParams.get('v')
            : null;
      if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
      return { url: `https://www.youtube.com/watch?v=${id}`, externalId: id };
    }
    case 'codesandbox_sandbox': {
      // https://codesandbox.io/s/<id> か /p/sandbox/<id> か /embed/<id>
      if (host !== 'codesandbox.io') return null;
      const id = segments.at(-1);
      const shapes = ['s', 'embed', 'sandbox'];
      if (!id || !shapes.includes(segments.at(-2) ?? '') || !/^[A-Za-z0-9-]+$/.test(id))
        return null;
      return { url: `https://codesandbox.io/s/${id}`, externalId: id };
    }
    case 'codepen_pen': {
      // https://codepen.io/<name>/pen/<id>
      if (host !== 'codepen.io') return null;
      const [name, pen, id] = segments;
      if (!name || pen !== 'pen' || !id || !/^[A-Za-z0-9]+$/.test(id)) return null;
      return { url: `https://codepen.io/${name}/pen/${id}`, externalId: id };
    }
    case 'unlisted':
      return { url: url.toString(), externalId: null };
  }
};
