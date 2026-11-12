import type { IntakeMode } from '@/features/activity/domain/fetched-item';

/**
 * 外部の取得元の表（specs/004-external-activity/research.md の R3・R7・R10）。取得元の名前は
 * `activity_source.source`（migrations/0012）の値で、取得元の名前を書くのはこの表だけにする。
 * 分類は D1 の `activity_source.kind` を正とし、ここに写さない（FR-001・FR-002）。
 * 取り込み方は保管するデータに持たない（FR-004）
 *
 * `hosts` は URL を指名する取得元が受け付けるホスト。ほかのホストの URL には要求を出さない
 * （R10、原則 2）。取得元「登録していないサイト」（`unlisted`）は、URL・題・日付を手で入力する
 * （plan.md の U11 の (a)。URL から題を取る処理は #281）
 */
export const SOURCES = {
  zenn: { intake: 'list' },
  qiita: { intake: 'list' },
  devto: { intake: 'list' },
  medium: { intake: 'list' },
  speakerdeck: { intake: 'list' },
  github: { intake: 'list' },
  connpass: { intake: 'list' },
  spotify: { intake: 'url', hosts: ['open.spotify.com'] },
  x: { intake: 'url', hosts: ['x.com', 'twitter.com'] },
  codesandbox: { intake: 'url', hosts: ['codesandbox.io'] },
  youtube: {
    intake: 'url',
    hosts: ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'],
  },
  codepen: { intake: 'manual' },
  unlisted: { intake: 'manual' },
} as const satisfies Record<string, { intake: IntakeMode; hosts?: readonly string[] }>;

export type ExternalSourceName = keyof typeof SOURCES;

/** 一覧を取る取得元 */
export type ListSourceName = {
  [Name in ExternalSourceName]: (typeof SOURCES)[Name]['intake'] extends 'list' ? Name : never;
}[ExternalSourceName];

export const LIST_SOURCES = (Object.keys(SOURCES) as ExternalSourceName[]).filter(
  (name): name is ListSourceName => SOURCES[name].intake === 'list',
);

const isExternalSourceName = (value: string): value is ExternalSourceName =>
  Object.hasOwn(SOURCES, value);

export const isListSourceName = (value: string): value is ListSourceName =>
  isExternalSourceName(value) && SOURCES[value].intake === 'list';

/** URL を指名する取得元 */
export type UrlSourceName = {
  [Name in ExternalSourceName]: (typeof SOURCES)[Name]['intake'] extends 'url' ? Name : never;
}[ExternalSourceName];

export const isUrlSourceName = (value: string): value is UrlSourceName =>
  isExternalSourceName(value) && SOURCES[value].intake === 'url';

/** オーナーが管理画面で登録・編集・削除する取得元（URL を指名する・手で入力する。FR-009・FR-010・FR-033） */
export type OwnedSourceName = Exclude<ExternalSourceName, ListSourceName>;

export const OWNED_SOURCES = (Object.keys(SOURCES) as ExternalSourceName[]).filter(
  (name): name is OwnedSourceName => SOURCES[name].intake !== 'list',
);

export const isOwnedSourceName = (value: string): value is OwnedSourceName =>
  isExternalSourceName(value) && SOURCES[value].intake !== 'list';

/** URL を指名する取得元の URL か。ホストが取得元の表のどれかと一致すれば真（R10、原則 2） */
export const isHostOf = (source: OwnedSourceName, url: string): boolean => {
  const entry = SOURCES[source];
  if (!('hosts' in entry)) return true;
  try {
    return (entry.hosts as readonly string[]).includes(new URL(url).hostname);
  } catch {
    return false;
  }
};
