import 'server-only';

import type { FetchedItem } from '@/features/activity/domain/fetched-item';
import type { FetchLimits } from '@/features/activity/domain/limits';
import {
  createSourceHttp,
  isClientError,
  type Fetcher,
} from '@/features/activity/server/sources/fetch-with-limits';
import { decodeEntities } from '@/features/activity/server/sources/rss';
import { isText } from '@/features/activity/server/sources/shape';
import { SOURCES } from '@/features/activity/domain/sources';

/**
 * CodeSandbox（#177「CodePen と CodeSandbox を手で登録できるようにする」。spec に従い URL を指名する
 * 形で作る）。公式の oEmbed は bot challenge で 403 を返すため、非公式の `/embed/<id>` の頁の
 * `og:title` を題にする（検証記録）。`og:image` が指す先は 403 なので画像は取らない
 *
 * 無い ID でも 200 でサイトの既定の OG を返すので、`og:title` が既定値なら取れない（null）とする。
 * 既定値は `CodeSandbox`（2026-11-09 に作り物の ID で実測）
 */

const DEFAULT_TITLE = 'CodeSandbox';

/** sandbox の URL の形（`/s/<id>`・`/embed/<id>`・`/p/sandbox/<id>`）から ID を読む */
const sandboxIdOf = (url: string): string | null => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // 取得元のホストの URL だけを読む（research.md の R10）
  if (!(SOURCES.codesandbox.hosts as readonly string[]).includes(parsed.hostname)) return null;
  const path = parsed.pathname.split('/').filter(Boolean);
  const [first, second, third] = path;
  const id =
    first === 's' || first === 'embed'
      ? second
      : first === 'p' && second === 'sandbox'
        ? third
        : undefined;
  return id !== undefined && /^[\w-]+$/.test(id) ? id : null;
};

const ogTitleOf = (html: string): string | null => {
  const tag =
    /<meta\b(?:[^>"']|"[^"]*"|'[^']*')*?\sproperty=["']og:title["'](?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(
      html,
    )?.[0];
  const content = tag && /\scontent=(?:"([^"]*)"|'([^']*)')/i.exec(tag);
  const value = content ? (content[1] ?? content[2]) : undefined;
  return value === undefined ? null : decodeEntities(value).trim();
};

export const fetchByUrl = async (
  fetcher: Fetcher,
  url: string,
  limits: FetchLimits,
): Promise<FetchedItem | null> => {
  const id = sandboxIdOf(url);
  if (id === null) return null;
  let text;
  try {
    ({ text } = await createSourceHttp(fetcher, limits).get(`https://codesandbox.io/embed/${id}`));
  } catch (error) {
    if (isClientError(error)) return null;
    throw error;
  }
  const title = ogTitleOf(text);
  return isText(title) && title !== DEFAULT_TITLE ? { url, title } : null;
};
