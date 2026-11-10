import type {
  ActivityRepository,
  ExternalActivityRepository,
  FetchResultWrite,
  RefreshPlan,
  StoredItem,
} from '@/features/activity/domain/activity-repository';
import { toPublishedOn, type ExternalActivity } from '@/features/activity/domain/external-activity';
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
      // 404 が続いた回数と消した行を、次の取り直しが読む保存した行に写す。回数の持ち越しを確かめるため
      const rows = initial[source];
      if (!rows) return;
      const deleted = new Set(plan.deletes);
      const counts = new Map(
        (plan.goneChecked ?? []).map(({ id, goneStreak }) => [id, goneStreak]),
      );
      const resets = new Set(plan.goneResets ?? []);
      initial[source] = rows
        .filter((row) => !deleted.has(row.id))
        .map((row) => ({
          ...row,
          goneStreak: resets.has(row.id) ? 0 : (counts.get(row.id) ?? row.goneStreak),
          goneCheckedAt: counts.has(row.id) ? result.fetchedAt : row.goneCheckedAt,
        }));
    },
    recordFetchFailure: async (source, fetchedAt, reason) => {
      failures.push({ source, fetchedAt, reason });
    },
    readValidators: async (source) => options.validators?.[source] ?? null,
    recordNotModified: async (source, fetchedAt) => {
      notModified.push({ source, fetchedAt });
    },
    listFetchedAt: async () => ({}),
  };
  return { repository, applied, failures, notModified };
};

/**
 * URL を指名した・手で入力した外部の activity を覚える、メモリの上の Repository。同じ取得元の
 * 同じ URL を拒む（D1 の `activity_source_url` の UNIQUE と同じ）
 */
export const createFakeExternalActivityRepository = (initial: ExternalActivity[] = []) => {
  const rows = new Map<number, ExternalActivity & { imageUrl: string | null }>(
    initial.map((row) => [row.id, { ...row, imageUrl: null }]),
  );
  let nextId = Math.max(0, ...initial.map((row) => row.id)) + 1;
  const isTaken = (source: string, url: string, except?: number) =>
    [...rows.values()].some((row) => row.source === source && row.url === url && row.id !== except);
  const repository: ExternalActivityRepository = {
    list: async () => [...rows.values()],
    findIdByUid: async (uid) => [...rows.values()].find((row) => row.uid === uid)?.id ?? null,
    findForEdit: async (id) => {
      const row = rows.get(id);
      return row
        ? {
            id: row.id,
            uid: row.uid,
            source: row.source,
            url: row.url,
            title: row.title,
            publishedOn: row.publishedOn,
          }
        : null;
    },
    register: async (source, content) => {
      if (isTaken(source, content.url)) return { ok: false, reason: 'url-taken' };
      const id = nextId++;
      const uid = id.toString(16).padStart(32, '0');
      rows.set(id, {
        id,
        uid,
        source,
        url: content.url,
        title: content.title,
        publishedOn: toPublishedOn(content.publishedAt),
        imageUrl: content.imageUrl,
      });
      return { ok: true, id, uid };
    },
    edit: async (id, changes) => {
      const row = rows.get(id);
      if (!row) return { ok: false, reason: 'not-found' };
      if (changes.url !== undefined && isTaken(row.source, changes.url, id)) {
        return { ok: false, reason: 'url-taken' };
      }
      rows.set(id, {
        ...row,
        url: changes.url ?? row.url,
        title: changes.title ?? row.title,
        publishedOn: toPublishedOn(changes.publishedAt),
      });
      return { ok: true };
    },
    delete: async (id) => rows.delete(id),
  };
  return { repository, rows };
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
