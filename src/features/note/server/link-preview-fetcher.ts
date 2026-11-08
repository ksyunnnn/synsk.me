import 'server-only';

import { LINK_PREVIEW_MAX_FETCHES, toPreviewImageUrl } from '@/features/note/domain/link-card';
import type { LinkPreview } from '@/features/note/domain/note';

/**
 * 参照先の URL から題と画像を取る（specs/003-note/research.md の R9）。参照先の HTML は
 * このファイルの中で `LinkPreview` に詰め替え、外に出さない（constitution VII、
 * docs/SOFTWARE_DESIGN.md の Anti-Corruption Layer）。
 *
 * 上限（constitution II）: 1 つあたり 5 秒で打ち切り、本文は 512 KB までしか読まない。
 * 私的なアドレスへ出さないことは `wrangler.jsonc` の `global_fetch_strictly_public` が持つ
 */

export const LINK_PREVIEW_TIMEOUT_MS = 5_000;
export const LINK_PREVIEW_MAX_BYTES = 512 * 1024;

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const decodeEntities = (value: string) =>
  value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point =
        code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });

const clean = (value: string | undefined) => {
  if (value === undefined) return null;
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim();
  return text === '' ? null : text;
};

/** タグの属性を読む。属性の順と引用符の種類を問わない */
const readAttributes = (tag: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    attributes[match[1].toLowerCase()] = match[3] ?? match[4] ?? match[5] ?? '';
  }
  return attributes;
};

/** HTML から題と画像の URL を読む。題は `og:title`、無ければ `<title>`。画像は `og:image` */
export const parseLinkPreviewHtml = (
  html: string,
): { title: string | null; image: string | null } => {
  const meta: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = readAttributes(tag);
    const name = (attributes.property ?? attributes.name)?.toLowerCase();
    if (name && attributes.content !== undefined && !(name in meta))
      meta[name] = attributes.content;
  }
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    title: clean(meta['og:title']) ?? clean(titleTag),
    image: clean(meta['og:image']),
  };
};

/** 本文を上限の大きさまで読む */
const readLimited = async (response: Response, maxBytes: number): Promise<string> => {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const bytes = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, bytes.length - offset);
    bytes.set(part, offset);
    offset += part.byteLength;
    if (offset >= bytes.length) break;
  }
  return new TextDecoder().decode(bytes);
};

/** 1 つの URL の参照先の情報。取れなければ null */
export const fetchLinkPreview = async (
  url: string,
  fetchImpl: Fetch = fetch,
): Promise<LinkPreview | null> => {
  try {
    const response = await fetchImpl(url, {
      headers: { accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(LINK_PREVIEW_TIMEOUT_MS),
    });
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || !/html/i.test(type)) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    const { title, image } = parseLinkPreviewHtml(
      await readLimited(response, LINK_PREVIEW_MAX_BYTES),
    );
    const imageUrl = toPreviewImageUrl(image, response.url || url);
    return title === null && imageUrl === null ? null : { url, title, imageUrl };
  } catch {
    return null;
  }
};

/**
 * 並べた URL の参照先の情報を取る。上限の数を超えた分は取りに行かない。取れなかった URL は
 * 返さず、ほかの URL の結果は返す（docs/SOFTWARE_DESIGN.md の「失敗の表し方」）
 */
export const fetchLinkPreviews = async (
  urls: string[],
  fetchImpl: Fetch = fetch,
): Promise<LinkPreview[]> => {
  const settled = await Promise.all(
    urls.slice(0, LINK_PREVIEW_MAX_FETCHES).map((url) => fetchLinkPreview(url, fetchImpl)),
  );
  return settled.filter((preview): preview is LinkPreview => preview !== null);
};
