import { fetchJson, PER_SOURCE_LIMIT } from '../registry';
import type { SourceResult, TimelineEntry, TimelineSource } from '../types';

/** 公式 API v2。未認証は 60 req/h/IP、トークン付きで 1000 req/h。 */
const ENDPOINT = `https://qiita.com/api/v2/users/ksyunnnn/items?per_page=${PER_SOURCE_LIMIT}`;
const REFERENCE = 'https://qiita.com/api/v2/docs';

interface QiitaItem {
  id: string;
  title: string;
  url: string;
  created_at: string;
  likes_count: number;
  stocks_count: number;
  tags: { name: string }[];
}

export const qiitaSource: TimelineSource = {
  platform: 'qiita',
  label: 'Qiita',
  fetch: async (): Promise<SourceResult> => {
    const token = process.env.QIITA_ACCESS_TOKEN;
    const response = await fetchJson<QiitaItem[]>(
      ENDPOINT,
      token ? { Authorization: `Bearer ${token}` } : {}
    );

    if (!response.ok || response.body === undefined) {
      return {
        platform: 'qiita',
        status: 'error',
        entries: [],
        note: `取得が ${response.status} で失敗した。未認証のレート制限は 60 req/h/IP。`,
        reference: REFERENCE,
        requiredEnv: ['QIITA_ACCESS_TOKEN'],
      };
    }

    const items = response.body;
    const entries: TimelineEntry[] = items.map((item) => ({
      id: `qiita:${item.id}`,
      kind: 'article',
      platform: 'qiita',
      title: item.title,
      url: item.url,
      publishedAt: new Date(item.created_at).toISOString(),
      metrics: [
        { label: 'LGTM', value: item.likes_count },
        { label: 'Stock', value: item.stocks_count },
      ],
      tags: item.tags.map((tag) => tag.name),
    }));

    return {
      platform: 'qiita',
      status: 'ok',
      entries,
      note: token
        ? '公式 API v2 を認証付きで取得した（1000 req/h）。'
        : '公式 API v2 を未認証で取得した。QIITA_ACCESS_TOKEN を設定すると 60 req/h から 1000 req/h になる。',
      reference: REFERENCE,
      requiredEnv: token ? undefined : ['QIITA_ACCESS_TOKEN'],
    };
  },
};
