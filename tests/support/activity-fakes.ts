import type {
  ActivityRepository,
  FetchResultWrite,
  RefreshPlan,
  StoredItem,
} from '@/features/activity/domain/activity-repository';
import type {
  NotModified,
  SourceListing,
  SourceName,
  Validators,
} from '@/features/activity/domain/fetched-item';
import type { Fetcher } from '@/features/activity/server/sources/fetch-with-limits';

/**
 * activity の単体の検査が渡す作り物（docs/SOFTWARE_DESIGN.md の Dependency Injection）。
 * 値はすべて作り物で、外へ要求を出さない
 */

/** 取得の書き込みを覚える、メモリの上の Repository */
export const createFakeActivityRepository = (
  initial: Record<SourceName, StoredItem[]> = {},
  options: { failApplyFor?: SourceName[]; validators?: Record<SourceName, Validators> } = {},
) => {
  const applied: { source: SourceName; plan: RefreshPlan; result: FetchResultWrite }[] = [];
  const failures: { source: SourceName; fetchedAt: string; reason: string }[] = [];
  const notModified: { source: SourceName; fetchedAt: string }[] = [];
  const repository: ActivityRepository = {
    listStoredForRefresh: async (source) => initial[source] ?? [],
    applyRefresh: async (source, plan, result) => {
      if (options.failApplyFor?.includes(source)) {
        throw new Error('作り物の書き込みの失敗');
      }
      applied.push({ source, plan, result });
    },
    recordFetchFailure: async (source, fetchedAt, reason) => {
      failures.push({ source, fetchedAt, reason });
    },
    readValidators: async (source) => options.validators?.[source] ?? null,
    recordNotModified: async (source, fetchedAt) => {
      notModified.push({ source, fetchedAt });
    },
  };
  return { repository, applied, failures, notModified };
};

/** URL ごとに決めた応答を返す fetcher。決めていない URL には 404 を返し、要求した URL を覚える */
export const createFakeFetcher = (
  responses: Record<string, () => Response>,
): { fetcher: Fetcher; requested: { url: string; headers: Headers }[] } => {
  const requested: { url: string; headers: Headers }[] = [];
  const fetcher: Fetcher = async (url, init) => {
    requested.push({ url, headers: new Headers(init?.headers) });
    const respond = responses[url];
    return respond ? respond() : new Response('', { status: 404 });
  };
  return { fetcher, requested };
};

/** JSON の本文と見出しを持つ応答 */
export const jsonResponse =
  (body: unknown, headers: Record<string, string> = {}) =>
  () =>
    new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json', ...headers },
    });

/** XML の本文を持つ応答 */
export const xmlResponse = (body: string) => () =>
  new Response(body, { headers: { 'Content-Type': 'application/rss+xml' } });

/** 条件を付けずに取った一覧。304 は条件を付けた要求にだけ返るので、ここに来れば検査の誤り */
export const asListing = (result: SourceListing | NotModified): SourceListing => {
  if ('notModified' in result) throw new Error('条件を付けていない要求に 304 が返った');
  return result;
};
