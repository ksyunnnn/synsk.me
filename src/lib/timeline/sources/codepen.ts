import { CODEPEN_PENS } from '@/data/manual-entries';
import type { SourceResult, TimelineEntry, TimelineSource } from '../types';

/**
 * CodePen は公開 API を持たない（公式ドキュメントに "We don't have a traditional API" と明記）。
 * 加えて codepen.io 全体が Cloudflare の bot challenge を返し、oEmbed も pen の
 * ページも RSS も、サーバ側からは 403 になる。取得の経路が無い。
 *
 * ただし**埋め込みは閲覧者のブラウザが直接読む**ため描画される。
 * 掲載対象と題を `src/data/manual-entries.ts` に持ち、埋め込み URL を組み立てる。
 */
const REFERENCE = 'https://blog.codepen.io/docs/api/';

export const codepenSource: TimelineSource = {
  platform: 'codepen',
  label: 'CodePen',
  fetch: async (): Promise<SourceResult> => {
    const entries: TimelineEntry[] = CODEPEN_PENS.map((pen) => ({
      id: `codepen:${pen.id}`,
      kind: 'sandbox',
      platform: 'codepen',
      title: pen.title,
      url: pen.url,
      publishedAt: pen.registeredAt,
      embedUrl: `https://codepen.io/ksyunnnn/embed/${pen.id}?default-tab=result`,
    }));

    if (entries.length === 0) {
      return {
        platform: 'codepen',
        status: 'unavailable',
        entries: [],
        note: '公開 API が無く、サーバ側からの取得は全経路が Cloudflare の bot challenge で 403 になる。掲載するには src/data/manual-entries.ts の CODEPEN_PENS に題と URL を持たせる。',
        reference: REFERENCE,
      };
    }

    return {
      platform: 'codepen',
      status: 'manual',
      entries,
      note: `サーバ側からの取得は全経路 403 のため、${entries.length} 件を手で登録している。埋め込みは閲覧者のブラウザが直接読むので描画される。並び順の日付は登録日。`,
      reference: REFERENCE,
    };
  },
};
