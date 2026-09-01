import type { SourceResult, TimelineEntry, TimelineSource } from './types';

/**
 * 1 source あたりの取得上限。
 * Timeline は時系列で混ぜるため、1 プラットフォームが占有しないよう揃える。
 */
export const PER_SOURCE_LIMIT = 10;

/** 取得の上限時間。1 source の遅延が全体を止めないようにする。 */
export const FETCH_TIMEOUT_MS = 8000;

export interface FetchResult<T> {
  ok: boolean;
  status: number;
  headers: Headers;
  /** ok が false のとき undefined。 */
  body?: T;
}

/**
 * 取得と本文の読み取りを 1 つの制限時間で覆う。
 *
 * ヘッダの受信時点でタイマーを解除すると、本文の読み取りが無制限になる。
 * RSS は本文が大きいため、解除は読み終えた後に行う。
 */
async function request<T>(
  url: string,
  read: (response: Response) => Promise<T>,
  headers: Record<string, string> = {},
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<FetchResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // 一部のプラットフォームは User-Agent の無いリクエストを拒否する。
        'User-Agent': 'synsk.me (+https://synsk.me)',
        ...headers,
      },
    });

    if (!response.ok) {
      return { ok: false, status: response.status, headers: response.headers };
    }
    return {
      ok: true,
      status: response.status,
      headers: response.headers,
      body: await read(response),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function fetchText(
  url: string,
  headers?: Record<string, string>
): Promise<FetchResult<string>> {
  return request(url, (response) => response.text(), headers);
}

export function fetchJson<T>(
  url: string,
  headers?: Record<string, string>
): Promise<FetchResult<T>> {
  return request(url, (response) => response.json() as Promise<T>, headers);
}

/**
 * 全 source を並列で取得する。
 * 1 source の失敗が他を巻き込まないよう、失敗も SourceResult として返す。
 */
export async function fetchAllSources(sources: TimelineSource[]): Promise<SourceResult[]> {
  const settled = await Promise.allSettled(sources.map((source) => source.fetch()));

  return settled.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    const source = sources[index];
    return {
      platform: source.platform,
      status: 'error' as const,
      entries: [],
      note: `取得中に例外が発生した: ${String(result.reason)}`,
    };
  });
}

/** 全 source のエントリを publishedAt の降順に混ぜる。 */
export function mergeEntries(results: SourceResult[]): TimelineEntry[] {
  return results
    .flatMap((result) => result.entries)
    .filter((entry) => !Number.isNaN(Date.parse(entry.publishedAt)))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/** publishedAt の年で束ねる。年は降順、年内も降順。 */
export function groupByYear(
  entries: TimelineEntry[]
): { year: number; entries: TimelineEntry[] }[] {
  const buckets = new Map<number, TimelineEntry[]>();

  for (const entry of entries) {
    const year = new Date(entry.publishedAt).getUTCFullYear();
    const bucket = buckets.get(year);
    if (bucket) bucket.push(entry);
    else buckets.set(year, [entry]);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, yearEntries]) => ({ year, entries: yearEntries }));
}
