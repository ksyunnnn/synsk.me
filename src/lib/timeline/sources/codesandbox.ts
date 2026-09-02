import { CODESANDBOX_SANDBOXES } from '@/data/manual-entries';
import { fetchText } from '../registry';
import type { SourceResult, TimelineEntry, TimelineSource } from '../types';

/**
 * CodeSandbox の公式 oEmbed は Cloudflare の bot challenge で 403 になる。
 * 通るのは `/embed/<id>` だけで、そこから OG メタを読む。非公式の経路である。
 *
 * 存在しない ID でも 200 とサイト既定の OG が返るため、既定値を弾く必要がある。
 */
const REFERENCE = 'https://codesandbox.io/docs';
const DEFAULT_OG_TITLE = 'CodeSandbox';

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/**
 * meta タグから 1 つの値を読む。
 *
 * property と content の出現順は保証されないため、タグを取り出してから中を見る。
 * content の値は引用符の種類を揃えて取り、値に別種の引用符が入っても切れないようにする。
 */
function readMeta(html: string, property: string): string | undefined {
  const key = new RegExp(`(?:property|name)\\s*=\\s*(["'])${property}\\1`, 'i');

  for (const tag of html.match(/<meta\s[^>]*>/gi) ?? []) {
    if (!key.test(tag)) continue;
    const content = tag.match(/content\s*=\s*(["'])([\s\S]*?)\1/i);
    if (content) {
      return content[2].replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => HTML_ENTITIES[entity]);
    }
  }
  return undefined;
}

export const codesandboxSource: TimelineSource = {
  platform: 'codesandbox',
  label: 'CodeSandbox',
  fetch: async (): Promise<SourceResult> => {
    const settled = await Promise.allSettled(
      CODESANDBOX_SANDBOXES.map(async (ref) => {
        const response = await fetchText(`https://codesandbox.io/embed/${ref.id}`);
        if (!response.ok || response.body === undefined) {
          throw new Error(`${ref.id} → ${response.status}`);
        }

        const html = response.body;
        const title = readMeta(html, 'og:title');
        // サイト既定の OG は、その ID の sandbox が無いことを意味する。
        if (!title || title === DEFAULT_OG_TITLE) throw new Error(`${ref.id} は既定の OG を返した`);

        const entry: TimelineEntry = {
          id: `codesandbox:${ref.id}`,
          kind: 'sandbox',
          platform: 'codesandbox',
          title,
          url: ref.url,
          // OG メタは日付を返さないため、登録日を並び順に使う。
          publishedAt: ref.registeredAt,
          summary: readMeta(html, 'og:description'),
          // og:image は https://codesandbox.io/api/v1/sandboxes/<id>/screenshot.png を
          // 指すが、これも bot challenge で 403 になる。壊れた画像を出さないため持たせない。
        };
        return entry;
      })
    );

    const entries = settled
      .filter(
        (result): result is PromiseFulfilledResult<TimelineEntry> => result.status === 'fulfilled'
      )
      .map((result) => result.value);
    const failed = settled.length - entries.length;

    return {
      platform: 'codesandbox',
      // 取得を試みて全件落ちたのは経路が無いことではない。unavailable と分ける。
      status: entries.length > 0 ? 'ok' : 'error',
      entries,
      note:
        `公式 oEmbed は Cloudflare の bot challenge で 403 になるため、/embed/<id> の OG メタから ${entries.length} 件取得した` +
        (failed > 0 ? `（${failed} 件は既定の OG または失敗）` : '') +
        '。非公式の経路であり、日付は登録日。',
      reference: REFERENCE,
    };
  },
};
