import type {
  ItemChanges,
  RefreshPlan,
  StoredItem,
} from '@/features/activity/domain/activity-repository';
import type { FetchedItem } from '@/features/activity/domain/fetched-item';

/**
 * 1 つの取得元の取り直しで、足す行と直す行を求める（docs/SOFTWARE_DESIGN.md の
 * 「読む → 計算 → 書く」の計算）。外への要求も D1 も触らない（research.md の R4・R5）
 *
 * - 同じ項目は、取得元が ID を返すときは ID で、返さないときは URL で判定する（FR-008）
 * - 値の変わった列だけを直し、変わらない行は書かない（R5）
 * - 公開日の無い項目で、保存した公開日を書き換えない（FR-012）。公開日の無い新しい項目は
 *   足さない（FR-011）
 * - 1 回の取得の中で同じ項目が 2 回出たら、最初の 1 つだけを使う。頁を辿るあいだに新しい項目が
 *   出て頁の境目がずれると、同じ項目が 2 つの頁に出る。両方を足す行にすると、UNIQUE が
 *   `batch()` を拒み、その取得元の書き込みがすべて戻る
 */
export const planRefresh = (stored: StoredItem[], fetched: FetchedItem[]): RefreshPlan => {
  const byExternalId = new Map<string, StoredItem>();
  const byUrl = new Map<string, StoredItem>();
  for (const row of stored) {
    if (row.externalId === null) byUrl.set(row.url, row);
    else byExternalId.set(row.externalId, row);
  }

  const plan: RefreshPlan = { inserts: [], updates: [], skippedWithoutDate: 0 };
  const seen = new Set<string>();
  for (const item of fetched) {
    const key = item.externalId === undefined ? `url:${item.url}` : `id:${item.externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const row =
      item.externalId === undefined ? byUrl.get(item.url) : byExternalId.get(item.externalId);
    if (row) {
      const changes = changesOf(row, item);
      if (Object.keys(changes).length > 0) plan.updates.push({ id: row.id, changes });
    } else if (item.publishedAt === undefined) {
      plan.skippedWithoutDate += 1;
    } else {
      plan.inserts.push({ ...item, publishedAt: item.publishedAt });
    }
  }
  return plan;
};

const changesOf = (row: StoredItem, item: FetchedItem): ItemChanges => {
  const changes: ItemChanges = {};
  if (row.url !== item.url) changes.url = item.url;
  if (row.title !== item.title) changes.title = item.title;
  if (item.publishedAt !== undefined && row.publishedAt !== item.publishedAt) {
    changes.publishedAt = item.publishedAt;
  }
  const imageUrl = item.imageUrl ?? null;
  if (row.imageUrl !== imageUrl) changes.imageUrl = imageUrl;
  return changes;
};
