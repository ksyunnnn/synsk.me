import 'server-only';

import { isWebUrl } from '@/shared/domain/web-url';

/**
 * 参照先のページから題と画像の URL を取る（specs/003-note/research.md の R13）。使い手は 003 の
 * URL カードと 004 の「URL から題を取ってフォームの初期値に入れる」（issue #281）。機能どうしは
 * import しないため `src/shared/` に置く（ADR-0026）。
 *
 * - 取った HTML は、このモジュールの中で題と画像の URL に詰め替え、外の形を持ち出さない
 *   （docs/SOFTWARE_DESIGN.md の Anti-Corruption Layer、constitution VII）
 * - 外への要求は数・時間・大きさに上限をかける（原則 2、constitution II）。値と出典は
 *   specs/003-note/plan.md の「参照先への取得の上限」
 * - 内部のアドレスへ要求を出さない（OWASP SSRF Prevention Cheat Sheet の Case 2）。名前を引いた後の
 *   アドレスは Workers では確かめられないため、`wrangler.jsonc` の `global_fetch_strictly_public`
 *   （要求を公開のインターネットから出したものとして送る）に任せる
 * - 失敗を投げず、URL ごとに取れたか取れなかったかを返す（失敗の表し方、原則 4）
 */

/** 外へ出す要求の上限 */
export type LinkPreviewLimits = {
  /** 1 回の呼び出しで取る URL の数。超えた分は取らない */
  maxUrls: number;
  /** 1 つの URL で辿るリダイレクトの段の数 */
  maxRedirects: number;
  /** 1 つの URL の待ち時間（ミリ秒）。リダイレクトと本文の読み込みを含む */
  timeoutMs: number;
  /** 1 本の応答から読む大きさ（バイト）。超えた分は読まない */
  maxBytes: number;
};

/** 本番の上限。根拠は specs/003-note/plan.md の「参照先への取得の上限」 */
export const LINK_PREVIEW_LIMITS: LinkPreviewLimits = {
  maxUrls: 5,
  maxRedirects: 2,
  timeoutMs: 3000,
  maxBytes: 512 * 1024,
};

/** 題の長さの上限（文字）。note の題の上限（specs/003-note の FR-005）と揃える */
const LINK_PREVIEW_TITLE_MAX_LENGTH = 200;

/** 画像の URL の長さの上限（文字）。超えた URL は持たない */
const IMAGE_URL_MAX_LENGTH = 2048;

/** 004 の取得と同じ値（src/features/activity/server/sources/fetch-with-limits.ts） */
const USER_AGENT = 'synsk.me (+https://synsk.me)';

/** `fetch` と同じ形の関数。単体の検査は作り物の応答を返す関数を渡す */
export type LinkPreviewFetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** ページから読んだ題と画像の URL。どちらも無ければ null */
export type LinkPreview = { title: string | null; imageUrl: string | null };

/**
 * 取れなかった理由。`blocked` は内部のアドレスなど要求を出さない URL、`http` は 2xx でない応答、
 * `network` は要求が投げた、`timeout` は待ち時間を超えた、`too-many-redirects` はリダイレクトの段の上限
 */
type LinkPreviewFailure = 'blocked' | 'http' | 'network' | 'timeout' | 'too-many-redirects';

/** 1 つの URL の取得の結果。`url` は渡した URL（リダイレクトの行き先ではない） */
export type LinkPreviewResult =
  | ({ status: 'fetched'; url: string } & LinkPreview)
  | { status: 'failed'; url: string; reason: LinkPreviewFailure };

type Options = { fetcher?: LinkPreviewFetcher; limits?: LinkPreviewLimits };

/**
 * 要求を出してよい URL か（OWASP SSRF Prevention Cheat Sheet の Case 2）。http か https で、
 * 既定のポートで、資格情報を持たず、ホストが IP の文字列でも内部の名前でもないこと。IP の文字列は
 * 記事の URL にほぼ現れないため、範囲で分けずにすべて拒む（原則 9）。URL の解析は `0x7f.1` や
 * `2130706433` を点で区切った IPv4 に揃えるため、その形だけを見ればよい
 */
export const isFetchableUrl = (url: URL): boolean => {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username !== '' || url.password !== '' || url.port !== '') return false;
  const host = url.hostname.replace(/\.+$/, '').toLowerCase();
  if (host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  if (!host.includes('.')) return false;
  // 内部の名前: RFC 6761（localhost）、RFC 6762（local）、RFC 8375（home.arpa）、ICANN が内部の用途に
  // 取っておいた internal。公開のインターネットで引けない名前: RFC 6761（invalid・test）
  return !/\.(localhost|local|internal|home\.arpa|invalid|test)$/.test(host);
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
  yen: '¥',
};

/** 文字参照を文字に戻す。名前の参照は HTML の属性と題によく現れるものだけを戻す */
const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code =
        ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[ref.toLowerCase()] ?? whole;
  });

/** 空白をつめ、上限の長さで切る。空なら null */
const toTitle = (raw: string | undefined): string | null => {
  if (raw === undefined) return null;
  const title = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  return title === '' ? null : [...title].slice(0, LINK_PREVIEW_TITLE_MAX_LENGTH).join('');
};

/** ページの URL で絶対にした画像の URL。http か https でなければ null */
const toImageUrl = (raw: string | undefined, pageUrl: string): string | null => {
  if (raw === undefined) return null;
  const value = decodeEntities(raw).trim();
  if (value === '') return null;
  let href: string;
  try {
    href = new URL(value, pageUrl).href;
  } catch {
    return null;
  }
  return isWebUrl(href) && href.length <= IMAGE_URL_MAX_LENGTH ? href : null;
};

const ATTRIBUTE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

/** meta の属性。名前は小文字にする */
const attributesOf = (tag: string): Map<string, string> => {
  const attributes = new Map<string, string>();
  for (const [, name, double, single, bare] of tag.matchAll(ATTRIBUTE)) {
    const key = name.toLowerCase();
    if (!attributes.has(key)) attributes.set(key, double ?? single ?? bare ?? '');
  }
  return attributes;
};

/**
 * HTML から題と画像の URL を読む（The Open Graph protocol、https://ogp.me/ ）。題は `og:title`・
 * `twitter:title`・`<title>` の順、画像は `og:image`・`twitter:image` の順で、最初に見つかった値を
 * 使う。注釈・`<script>`・`<style>` の中は読まない
 */
export const readLinkPreview = (html: string, pageUrl: string): LinkPreview => {
  const text = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '');

  const meta = new Map<string, string>();
  for (const [tag] of text.matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const attributes = attributesOf(tag.slice('<meta'.length));
    const key = (attributes.get('property') ?? attributes.get('name'))?.toLowerCase();
    const content = attributes.get('content');
    if (key !== undefined && content !== undefined && !meta.has(key)) meta.set(key, content);
  }
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(text)?.[1];

  return {
    title: toTitle(meta.get('og:title')) ?? toTitle(meta.get('twitter:title')) ?? toTitle(titleTag),
    imageUrl:
      toImageUrl(meta.get('og:image'), pageUrl) ?? toImageUrl(meta.get('twitter:image'), pageUrl),
  };
};

/** 名前の文字コードの読み手。読めない名前なら null */
const decoderFor = (label: string | undefined): TextDecoder | null => {
  if (label === undefined) return null;
  try {
    return new TextDecoder(label);
  } catch {
    return null;
  }
};

/** 先頭の meta の宣言を探す大きさ（バイト）。HTML の文字コードの判定の前読みと同じ */
const PRESCAN_BYTES = 1024;

/**
 * 本文の文字コードを決める。BOM、Content-Type の charset、先頭 1024 バイトの meta の宣言
 * （`<meta charset>` と `<meta http-equiv="Content-Type">`）、UTF-8 の順で、最初に読める名前を使う
 * （HTML Standard の「Determining the character encoding」の簡略。https://html.spec.whatwg.org/multipage/parsing.html#determining-the-character-encoding ）
 */
const decoderOf = (bytes: Uint8Array, contentType: string): TextDecoder => {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8');
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be');
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le');
  const header = decoderFor(/charset\s*=\s*"?([^";\s]+)/i.exec(contentType)?.[1]);
  if (header !== null) return header;
  // ASCII と同じ並びの文字コードの宣言だけを探すため、1 バイトを 1 文字に読む
  const prescan = new TextDecoder('latin1').decode(bytes.subarray(0, PRESCAN_BYTES));
  const declared = /<meta\b[^>]*?charset\s*=\s*["']?\s*([^"'\s;>/]+)/i.exec(prescan)?.[1];
  const meta = decoderFor(declared);
  // meta で UTF-16 と宣言したページは、ASCII の並びで書けているため UTF-8 で読む（同じ節）
  if (meta !== null && !meta.encoding.startsWith('utf-16')) return meta;
  return new TextDecoder('utf-8');
};

const HEAD_END = [...'</head>'].map((char) => char.charCodeAt(0));
const HEAD_END_UPPER = [...'</HEAD>'].map((char) => char.charCodeAt(0));

/** `from` から後ろで `</head>` が終わる位置。ASCII の大文字小文字を区別しない。無ければ -1 */
const headEndOf = (bytes: Uint8Array, from: number): number => {
  for (let start = Math.max(0, from); start + HEAD_END.length <= bytes.length; start++) {
    let index = 0;
    while (
      index < HEAD_END.length &&
      (bytes[start + index] === HEAD_END[index] || bytes[start + index] === HEAD_END_UPPER[index])
    )
      index++;
    if (index === HEAD_END.length) return start + index;
  }
  return -1;
};

/**
 * 本文を上限の大きさまで読む。`</head>` まで読んだら残りを読まない。バイトのまま貯めてから
 * 文字コードを決めて読む（meta の宣言は本文の中にあるため）
 */
const readHead = async (response: Response, maxBytes: number): Promise<string> => {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const buffer = new Uint8Array(maxBytes);
  let size = 0;
  try {
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, maxBytes - size);
      buffer.set(chunk, size);
      const searchFrom = size - (HEAD_END.length - 1);
      size += chunk.byteLength;
      const headEnd = headEndOf(buffer.subarray(0, size), searchFrom);
      if (headEnd !== -1) {
        size = headEnd;
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = buffer.subarray(0, size);
  return decoderOf(bytes, response.headers.get('Content-Type') ?? '').decode(bytes);
};

const isRedirect = (status: number) => [301, 302, 303, 307, 308].includes(status);

const isHtml = (contentType: string) =>
  /^\s*(text\/html|application\/xhtml\+xml)\b/i.test(contentType);

class Timeout extends Error {}

/** リダイレクトを 1 段ずつ確かめて辿り、行き先のページを読む */
const follow = async (
  url: string,
  fetcher: LinkPreviewFetcher,
  limits: LinkPreviewLimits,
  signal: AbortSignal,
): Promise<LinkPreviewResult> => {
  let current = url;
  for (let hop = 0; ; hop++) {
    const target = new URL(current);
    if (!isFetchableUrl(target)) return { status: 'failed', url, reason: 'blocked' };
    let response: Response;
    try {
      // 自動で辿ると、確かめていない行き先へ要求を出す（OWASP SSRF Prevention Cheat Sheet）
      response = await fetcher(target.href, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        redirect: 'manual',
        signal,
      });
    } catch (error) {
      if (error instanceof Timeout || signal.aborted) throw new Timeout();
      return { status: 'failed', url, reason: 'network' };
    }
    if (isRedirect(response.status)) {
      await response.body?.cancel().catch(() => {});
      const location = response.headers.get('Location');
      if (location === null) return { status: 'failed', url, reason: 'http' };
      if (hop >= limits.maxRedirects)
        return { status: 'failed', url, reason: 'too-many-redirects' };
      try {
        current = new URL(location, target).href;
      } catch {
        return { status: 'failed', url, reason: 'http' };
      }
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return { status: 'failed', url, reason: 'http' };
    }
    if (!isHtml(response.headers.get('Content-Type') ?? '')) {
      await response.body?.cancel().catch(() => {});
      return { status: 'fetched', url, title: null, imageUrl: null };
    }
    const head = await readHead(response, limits.maxBytes);
    return { status: 'fetched', url, ...readLinkPreview(head, target.href) };
  }
};

/** 1 つの URL の題と画像の URL を取る。投げない */
export const fetchLinkPreview = async (
  url: string,
  { fetcher = fetch, limits = LINK_PREVIEW_LIMITS }: Options = {},
): Promise<LinkPreviewResult> => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: 'failed', url, reason: 'blocked' };
  }
  if (!isFetchableUrl(parsed)) return { status: 'failed', url, reason: 'blocked' };

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // fetcher と本文の読み込みが中止の合図を見なくても、待ち時間で打ち切る
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Timeout());
    }, limits.timeoutMs);
  });
  try {
    return await Promise.race([follow(url, fetcher, limits, controller.signal), timeout]);
  } catch (error) {
    return { status: 'failed', url, reason: error instanceof Timeout ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
};

/** 要求を出してよい URL か。URL として読めなければ false */
const isFetchableText = (url: string): boolean => {
  try {
    return isFetchableUrl(new URL(url));
  } catch {
    return false;
  }
};

/**
 * URL の並びの題と画像の URL を、上限の数まで並べて取る。要求を出さない URL は上限の数に数えず
 * `blocked` の失敗にする（取れない URL が前に並んでも後ろの URL を取るため）。超えた分には要求を
 * 出さず、結果にも含めない。結果は渡した URL の順
 */
export const fetchLinkPreviews = (
  urls: string[],
  options: Options = {},
): Promise<LinkPreviewResult[]> => {
  const limits = options.limits ?? LINK_PREVIEW_LIMITS;
  let remaining = limits.maxUrls;
  const targets = urls.filter((url) => !isFetchableText(url) || remaining-- > 0);
  return Promise.all(targets.map((url) => fetchLinkPreview(url, options)));
};
