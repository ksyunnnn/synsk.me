import 'server-only';

import { toUrlCheck, type RegisteredFetchOutcome } from '@/features/activity/domain/fetched-item';
import type { UrlSource } from '@/features/activity/domain/source';
import { isWebUrl } from '@/shared/domain/web-url';
import { getText, parseJson, recordOf, stringOf, type Http } from './http';
import { stripTags } from './rss';

/**
 * URL を指名する取得元から、1 件の題と代表の画像を取る（specs/004-external-activity/research.md
 * の R9）。X・Spotify・YouTube は oEmbed、CodeSandbox は `/embed/<id>` の og:title を読む。
 * 公開日は読まない。日付はオーナーが入れる（FR-011）
 */

/** 題の文字数の上限。X の投稿は本文を題にするため、長い本文を切る */
const MAX_TITLE_CHARS = 200;

const truncate = (value: string) =>
  [...value].length > MAX_TITLE_CHARS
    ? `${[...value].slice(0, MAX_TITLE_CHARS - 1).join('')}…`
    : value;

const NO_TITLE = '取得元が題を返さなかった';

const fromOEmbed = async (
  http: Http,
  endpoint: string,
  readTitle: (body: Record<string, unknown>) => string | null,
  readImage: (body: Record<string, unknown>) => string | null,
): Promise<RegisteredFetchOutcome> => {
  const response = await getText(http, endpoint);
  if (!response.ok) {
    const gone = response.status !== null && toUrlCheck(response.status) === 'gone';
    return { ok: false, reason: response.reason, gone };
  }
  const body = recordOf(parseJson(response.text));
  if (!body) return { ok: false, reason: '応答が oEmbed の形でない', gone: false };
  const title = readTitle(body)?.trim();
  if (!title) return { ok: false, reason: NO_TITLE, gone: false };
  const imageUrl = readImage(body);
  return {
    ok: true,
    title: truncate(title),
    imageUrl: imageUrl && isWebUrl(imageUrl) ? imageUrl : null,
  };
};

/** X の oEmbed は題を持たない。`html` の投稿の本文（最初の `<p>`）を題にする */
const xPostText = (body: Record<string, unknown>) => {
  const html = stringOf(body.html);
  const paragraph = html ? /<p\b[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] : undefined;
  return paragraph === undefined ? null : stripTags(paragraph);
};

const encode = encodeURIComponent;

/** CodeSandbox の既定の og:title。存在しない ID でもこの値で 200 を返す（PR #47 の検証記録） */
const isDefaultCodeSandboxTitle = (title: string) => /^codesandbox$/i.test(title.trim());

const fetchCodeSandbox = async (http: Http, url: string): Promise<RegisteredFetchOutcome> => {
  const id = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '';
  const response = await getText(http, `https://codesandbox.io/embed/${encode(id)}`);
  if (!response.ok) {
    const gone = response.status !== null && toUrlCheck(response.status) === 'gone';
    return { ok: false, reason: response.reason, gone };
  }
  const title = /<meta\b[^>]*property="og:title"[^>]*content="([^"]*)"/.exec(response.text)?.[1];
  if (!title || isDefaultCodeSandboxTitle(title)) {
    return { ok: false, reason: NO_TITLE, gone: false };
  }
  // 「<題> - CodeSandbox」の末尾を外す。og:image が指す画像は 403 を返すため使わない
  return {
    ok: true,
    title: truncate(stripTags(title).replace(/\s+-\s+CodeSandbox$/, '')),
    imageUrl: null,
  };
};

export const fetchRegisteredItem = (
  http: Http,
  source: UrlSource,
  url: string,
): Promise<RegisteredFetchOutcome> => {
  switch (source) {
    case 'x_post':
      return fromOEmbed(
        http,
        `https://publish.x.com/oembed?url=${encode(url)}&omit_script=1`,
        xPostText,
        () => null,
      );
    case 'spotify_playlist':
      return fromOEmbed(
        http,
        `https://open.spotify.com/oembed?url=${encode(url)}`,
        (body) => stringOf(body.title),
        (body) => stringOf(body.thumbnail_url),
      );
    case 'youtube_video':
      return fromOEmbed(
        http,
        `https://www.youtube.com/oembed?url=${encode(url)}&format=json`,
        (body) => stringOf(body.title),
        (body) => stringOf(body.thumbnail_url),
      );
    case 'codesandbox_sandbox':
      return fetchCodeSandbox(http, url);
  }
};
