import { PLATFORM_META } from '@/lib/timeline/platforms';
import type { TimelineEntry } from '@/lib/timeline/types';

/** 案 Casual の動詞。完全な文にする。 */
export function casualVerb(entry: TimelineEntry): string {
  const platform = PLATFORM_META[entry.platform].label;
  switch (entry.kind) {
    case 'article':
      return `Published an article on ${platform}`;
    case 'repository':
      return `Published a project on ${platform}`;
    case 'talk':
      return `Gave a talk on ${platform}`;
    case 'sandbox':
      return `Shared a sandbox on ${platform}`;
    case 'event':
      return `Joined an event on ${platform}`;
    case 'playlist':
      return `Shared a playlist on ${platform}`;
    case 'post':
      return `Posted on ${platform}`;
  }
}

/** 案 Catnose の動詞。カテゴリ単位の短句にする。 */
export function catnoseVerb(entry: TimelineEntry): string {
  const platform = PLATFORM_META[entry.platform].label;
  switch (entry.kind) {
    case 'article':
      return `Published a post on ${platform}`;
    case 'repository':
      return 'New OSS project';
    case 'talk':
      return `Presented on ${platform}`;
    case 'sandbox':
    case 'playlist':
      return 'Released';
    case 'event':
      return 'Joined';
    case 'post':
      return 'Posted';
  }
}

const KIND_LABEL: Record<TimelineEntry['kind'], string> = {
  article: 'ARTICLE',
  repository: 'REPOSITORY',
  talk: 'TALK',
  sandbox: 'SANDBOX',
  event: 'EVENT',
  playlist: 'PLAYLIST',
  post: 'POST',
};

/**
 * 案 Chic のラベル。プラットフォームに種別が 1 つしかない場合は種別名を省く。
 * 省く対象は、その Platform が 1 種別しか出さないもの。
 */
const SINGLE_KIND_PLATFORMS = new Set(['spotify', 'speakerdeck', 'connpass', 'codepen', 'x']);

export function chicLabel(entry: TimelineEntry): string {
  const platform = PLATFORM_META[entry.platform].label.toUpperCase();
  if (SINGLE_KIND_PLATFORMS.has(entry.platform)) return platform;
  return `${platform} · ${KIND_LABEL[entry.kind]}`;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** `<time datetime>` に入れる機械可読値。表示形式に関わらず常に完全な日付。 */
export function isoDate(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

/** `MM-DD`。年グループの中では年が自明なので省く。 */
export function monthDay(value: string): string {
  return isoDate(value).slice(5);
}

/** `MMM D`。案 Catnose のピル。 */
export function shortDate(value: string): string {
  const date = new Date(value);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** `MMM D, YYYY`。案 Catnose のカード内メタ。 */
export function longDate(value: string): string {
  return `${shortDate(value)}, ${new Date(value).getUTCFullYear()}`;
}

/**
 * 案 Casual の日付。30 日未満は相対表記にする。
 * `now` を引数に取り、サーバとクライアントで同じ値を出せるようにする。
 */
export function relativeDate(value: string, now: number): string {
  const days = Math.floor((now - Date.parse(value)) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return monthDay(value);
}
