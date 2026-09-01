import { fetchJson, PER_SOURCE_LIMIT } from '../registry';
import type { SourceResult, TimelineEntry, TimelineSource } from '../types';

/**
 * Forem API v1。認証不要だが User-Agent が無いと 403 を返す。
 * registry.ts の request が User-Agent を必ず付ける。
 */
const ENDPOINT = `https://dev.to/api/articles?username=ksyunnnn&per_page=${PER_SOURCE_LIMIT}`;
const REFERENCE = 'https://developers.forem.com/api/v1';

interface DevtoArticle {
  id: number;
  title: string;
  description: string;
  url: string;
  published_at: string;
  public_reactions_count: number;
  comments_count: number;
  social_image: string | null;
  tag_list: string[];
}

export const devtoSource: TimelineSource = {
  platform: 'devto',
  label: 'dev.to',
  fetch: async (): Promise<SourceResult> => {
    const response = await fetchJson<DevtoArticle[]>(ENDPOINT);
    if (!response.ok || response.body === undefined) {
      return {
        platform: 'devto',
        status: 'error',
        entries: [],
        note: `取得が ${response.status} で失敗した。User-Agent が無いと 403 を返す。`,
        reference: REFERENCE,
      };
    }

    const articles = response.body;
    const entries: TimelineEntry[] = articles.map((article) => ({
      id: `devto:${article.id}`,
      kind: 'article',
      platform: 'devto',
      title: article.title,
      url: article.url,
      publishedAt: new Date(article.published_at).toISOString(),
      summary: article.description || undefined,
      thumbnailUrl: article.social_image ?? undefined,
      metrics: [{ label: 'Reactions', value: article.public_reactions_count }],
      tags: article.tag_list,
    }));

    return {
      platform: 'devto',
      status: 'ok',
      entries,
      note: '公式 Forem API v1 を認証なしで取得した。User-Agent ヘッダが必須。',
      reference: REFERENCE,
    };
  },
};
