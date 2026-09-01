import { fetchWithTimeout, PER_SOURCE_LIMIT } from '../registry';
import type { SourceResult, TimelineEntry, TimelineSource } from '../types';

/**
 * connpass API v1 は廃止され 403 を返す。v2 は API キー必須で、
 * ヘッダ名は OpenAPI の securitySchemes に `X-API-Key` と定義されている。
 * 個人・コミュニティ利用は無料だが申請と審査を要する。
 */
const ENDPOINT = `https://connpass.com/api/v2/users/ksyunnnn/attended_events/?count=${PER_SOURCE_LIMIT}`;
const REFERENCE = 'https://connpass.com/about/api/v2/';

interface ConnpassEvent {
  id: number;
  title: string;
  catch: string | null;
  url: string;
  started_at: string;
  accepted: number;
  place: string | null;
}

export const connpassSource: TimelineSource = {
  platform: 'connpass',
  label: 'connpass',
  fetch: async (): Promise<SourceResult> => {
    const apiKey = process.env.CONNPASS_API_KEY;

    if (!apiKey) {
      return {
        platform: 'connpass',
        status: 'fixture',
        entries: [],
        note: 'API キーが未設定のため取得していない。CONNPASS_API_KEY を設定すると v2 API から取得する。個人利用は無料だが申請と審査を要する。',
        reference: REFERENCE,
        requiredEnv: ['CONNPASS_API_KEY'],
      };
    }

    const response = await fetchWithTimeout(ENDPOINT, { headers: { 'X-API-Key': apiKey } });
    if (!response.ok) {
      return {
        platform: 'connpass',
        status: 'error',
        entries: [],
        note: `取得が ${response.status} で失敗した。v2 の制限は API キーごとに 1 req/sec。`,
        reference: REFERENCE,
        requiredEnv: ['CONNPASS_API_KEY'],
      };
    }

    const data = (await response.json()) as { events?: ConnpassEvent[] };
    const entries: TimelineEntry[] = (data.events ?? []).map((event) => ({
      id: `connpass:${event.id}`,
      kind: 'event',
      platform: 'connpass',
      title: event.title,
      url: event.url,
      publishedAt: new Date(event.started_at).toISOString(),
      summary: event.catch ?? undefined,
      metrics: [{ label: 'Accepted', value: event.accepted }],
    }));

    return {
      platform: 'connpass',
      status: 'ok',
      entries,
      note: 'v2 API から参加イベントを取得した。制限は API キーごとに 1 req/sec。',
      reference: REFERENCE,
    };
  },
};
