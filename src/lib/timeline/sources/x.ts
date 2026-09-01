import { X_POSTS } from '@/data/manual-entries';
import { fetchJson } from '../registry';
import type { SourceResult, TimelineEntry, TimelineSource } from '../types';

/**
 * X API v2 は従量課金で、無料枠の記載が公式ドキュメントに無い。
 * 認証不要で使えるのは oEmbed だけで、これは個別ツイート指定のため一覧を取れない。
 * 掲載対象は `src/data/manual-entries.ts` で指名する。
 */
const OEMBED = 'https://publish.x.com/oembed';
const REFERENCE = 'https://docs.x.com/x-api/getting-started/pricing';

interface XOembed {
  html: string;
  author_name: string;
}

/** oEmbed は本文を HTML で返す。抜粋に使うため最初の段落からテキストを取る。 */
function textFromHtml(html: string): string | undefined {
  const paragraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1];
  if (!paragraph) return undefined;
  const text = paragraph
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0 ? text : undefined;
}

export const xSource: TimelineSource = {
  platform: 'x',
  label: 'X',
  fetch: async (): Promise<SourceResult> => {
    if (X_POSTS.length === 0) {
      return {
        platform: 'x',
        status: 'unavailable',
        entries: [],
        note: '無料での一覧取得ができない。認証不要なのは個別ツイート指定の oEmbed のみで、src/data/manual-entries.ts の X_POSTS に URL を並べると取得する。',
        reference: REFERENCE,
      };
    }

    const settled = await Promise.allSettled(
      X_POSTS.map(async (ref) => {
        const response = await fetchJson<XOembed>(
          `${OEMBED}?url=${encodeURIComponent(ref.url)}&omit_script=1`
        );
        if (!response.ok || response.body === undefined) {
          throw new Error(`${ref.url} → ${response.status}`);
        }
        const data = response.body;

        const entry: TimelineEntry = {
          id: `x:${ref.url}`,
          kind: 'post',
          platform: 'x',
          title: textFromHtml(data.html) ?? ref.url,
          url: ref.url,
          publishedAt: ref.registeredAt,
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
      platform: 'x',
      status: entries.length > 0 ? 'ok' : 'error',
      entries,
      note:
        entries.length > 0
          ? `oEmbed から ${entries.length} 件取得した` +
            (failed > 0 ? `（${failed} 件が失敗）` : '') +
            '。一覧取得の経路が無いため掲載対象は手で指名する。'
          : `指名した ${settled.length} 件すべてで oEmbed の取得に失敗した。`,
      reference: REFERENCE,
    };
  },
};
