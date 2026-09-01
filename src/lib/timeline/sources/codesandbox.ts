import { CODESANDBOX_IDS } from '@/data/manual-entries';
import { fetchWithTimeout } from '../registry';
import type { SourceResult, TimelineEntry, TimelineSource } from '../types';

/**
 * CodeSandbox の公式 oEmbed は Cloudflare の bot challenge で 403 になる。
 * 通るのは `/embed/<id>` だけで、そこから OG メタを読む。非公式の経路である。
 *
 * 存在しない ID でも 200 とサイト既定の OG が返るため、既定値を弾く必要がある。
 */
const REFERENCE = 'https://codesandbox.io/docs';
const DEFAULT_OG_TITLE = 'CodeSandbox';

function readMeta(html: string, property: string): string | undefined {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
    'i',
  );
  return html.match(pattern)?.[1];
}

export const codesandboxSource: TimelineSource = {
  platform: 'codesandbox',
  label: 'CodeSandbox',
  fetch: async (): Promise<SourceResult> => {
    const settled = await Promise.allSettled(
      CODESANDBOX_IDS.map(async (id) => {
        const response = await fetchWithTimeout(`https://codesandbox.io/embed/${id}`);
        if (!response.ok) throw new Error(`${id} → ${response.status}`);

        const html = await response.text();
        const title = readMeta(html, 'og:title');
        // サイト既定の OG は、その ID の sandbox が無いことを意味する。
        if (!title || title === DEFAULT_OG_TITLE) throw new Error(`${id} は既定の OG を返した`);

        const entry: TimelineEntry = {
          id: `codesandbox:${id}`,
          kind: 'sandbox',
          platform: 'codesandbox',
          title,
          url: `https://codesandbox.io/s/${id}`,
          // OG メタは日付を持たない。登録順を保つため配列の並びを日付に写す。
          publishedAt: new Date(Date.UTC(2026, 8, 2)).toISOString(),
          summary: readMeta(html, 'og:description'),
          thumbnailUrl: readMeta(html, 'og:image'),
        };
        return entry;
      }),
    );

    const entries = settled
      .filter((result): result is PromiseFulfilledResult<TimelineEntry> => result.status === 'fulfilled')
      .map((result) => result.value);
    const failed = settled.length - entries.length;

    return {
      platform: 'codesandbox',
      status: entries.length > 0 ? 'ok' : 'unavailable',
      entries,
      note:
        `公式 oEmbed は Cloudflare の bot challenge で 403 になるため、/embed/<id> の OG メタから ${entries.length} 件取得した` +
        (failed > 0 ? `（${failed} 件は既定の OG または失敗）` : '') +
        '。非公式の経路であり、日付は登録日。',
      reference: REFERENCE,
    };
  },
};
