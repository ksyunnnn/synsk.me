import type { SourceResult, TimelineSource } from '../types';

/**
 * CodePen は公開 API を持たない（公式ドキュメントに "We don't have a traditional API" と明記）。
 * oEmbed も codepen.io 全体の Cloudflare bot challenge により 403 を返し、
 * サーバ側 fetch からメタデータを取る経路が無い。
 *
 * 掲載するなら、タイトルと日付を手で持つことになる。
 */
const REFERENCE = 'https://blog.codepen.io/docs/api/';

export const codepenSource: TimelineSource = {
  platform: 'codepen',
  label: 'CodePen',
  fetch: async (): Promise<SourceResult> => ({
    platform: 'codepen',
    status: 'unavailable',
    entries: [],
    note: '公開 API が無く、oEmbed も Cloudflare の bot challenge で 403 になる。取得の経路が無いため、掲載するにはタイトルと日付を手で持つ必要がある。',
    reference: REFERENCE,
  }),
};
