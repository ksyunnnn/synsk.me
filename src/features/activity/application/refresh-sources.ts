import type { ActivityDeps } from '@/features/activity/application/deps';
import { planRefresh } from '@/features/activity/application/plan-refresh';
import { pickGoneChecks, planRemovals } from '@/features/activity/application/plan-removals';
import type { StoredItem } from '@/features/activity/domain/activity-repository';
import type {
  GoneCheck,
  RefreshOutcome,
  SourceListing,
  SourceName,
} from '@/features/activity/domain/fetched-item';
import type { RefreshLimits } from '@/features/activity/domain/limits';

/**
 * 一覧を取る取得元から取り直す（specs/004-external-activity/contracts/fetch.md、research.md の R4）。
 * 取得元ごとに「読む → 計算 → 書く」を行い、1 つの取得元の書き込みと取得の結果を 1 回の
 * `batch()` で書く。取得元どうしは `Promise.allSettled` で並べ、1 つの失敗でほかを止めない
 * （FR-015、docs/SOFTWARE_DESIGN.md の「失敗の表し方」）。取得か書き込みが失敗した取得元は、
 * activity を書き換えず、取得の結果に失敗と理由を書く（FR-014・FR-016）。取得元で消えたと
 * 確かめた行は、足す行・直す行と同じ書き込みで消す（FR-017〜FR-019）。取得元ごとの成否を返し、投げない
 */
export const refreshSources = async (
  deps: ActivityDeps,
  sources: SourceName[],
  now: string,
  limits: RefreshLimits,
): Promise<RefreshOutcome[]> => {
  // 読む・書くの外で投げた（計算を含む）ときも、取得の結果に失敗を書く。書かないと
  // `fetch_result.fetched_at` が進まず、古い順に取得元を選ぶ実行の分け方（research.md の R9）で毎回先に選ばれる
  const settled = await Promise.allSettled(
    sources.map((source) =>
      refreshSource(deps, source, now, limits).catch((error: unknown) =>
        fail(deps, source, now, `取り直しに失敗した: ${messageOf(error)}`),
      ),
    ),
  );
  return settled.map((result, index): RefreshOutcome =>
    result.status === 'fulfilled'
      ? result.value
      : { source: sources[index] ?? '', ok: false, reason: messageOf(result.reason) },
  );
};

const refreshSource = async (
  deps: ActivityDeps,
  source: SourceName,
  now: string,
  limits: RefreshLimits,
): Promise<RefreshOutcome> => {
  let read;
  let previous;
  try {
    previous = await deps.activities.readValidators(source);
    read = await Promise.all([
      deps.fetchListing(source, limits, previous),
      deps.activities.listStoredForRefresh(source),
    ]);
  } catch (error) {
    return fail(deps, source, now, `取得に失敗した: ${messageOf(error)}`);
  }
  const [listing, stored] = read;
  // 取得元が変わっていないと答えた。activity を書かず、取得の結果を成功として書く（research.md の R9）。
  // 一覧に載らない古い記事を消しても RSS は変わらないので、304 の回も保存した行を個別の URL で
  // 確かめる（R6）。一覧の中身が無いので、保存したすべての行から確かめた日時の古い順に選ぶ
  if ('notModified' in listing) {
    const checks = await checkGoneOf(
      deps,
      source,
      stored,
      { items: [], isComplete: false },
      limits,
    );
    try {
      if (checks.checked.length === 0) {
        await deps.activities.recordNotModified(source, now);
        return {
          source,
          ok: true,
          added: 0,
          updated: 0,
          removed: 0,
          keptOverLimit: 0,
          skippedWithoutDate: 0,
        };
      }
      const removals = planRemovals(
        stored,
        { items: [], isComplete: false },
        limits.maxRemovals,
        checks.gone,
      );
      const deleted = new Set(removals.deletes);
      const goneChecked = checks.checked.filter((id) => !deleted.has(id));
      const reason =
        removals.keptOverLimit > 0
          ? `消す候補が ${removals.keptOverLimit} 件で、上限（${limits.maxRemovals} 件）を超えたので、1 件も消さなかった`
          : null;
      await deps.activities.applyRefresh(
        source,
        {
          inserts: [],
          updates: [],
          skippedWithoutDate: 0,
          deletes: removals.deletes,
          ...(goneChecked.length > 0 && { goneChecked }),
        },
        { fetchedAt: now, reason, validators: reason === null ? previous : null },
      );
      return {
        source,
        ok: true,
        added: 0,
        updated: 0,
        removed: removals.deletes.length,
        keptOverLimit: removals.keptOverLimit,
        skippedWithoutDate: 0,
      };
    } catch (error) {
      return fail(deps, source, now, `書き込みに失敗した: ${messageOf(error)}`);
    }
  }
  const upserts = planRefresh(stored, listing.items);
  const checks = await checkGoneOf(deps, source, stored, listing, limits);
  const removals = planRemovals(stored, listing, limits.maxRemovals, checks.gone);
  const deleted = new Set(removals.deletes);
  const goneChecked = checks.checked.filter((id) => !deleted.has(id));
  const plan = {
    ...upserts,
    deletes: removals.deletes,
    ...(goneChecked.length > 0 && { goneChecked }),
  };
  const reasons = [
    upserts.skippedWithoutDate > 0
      ? `公開日の無い項目を ${upserts.skippedWithoutDate} 件、取り込まなかった`
      : null,
    removals.keptOverLimit > 0
      ? `消す候補が ${removals.keptOverLimit} 件で、上限（${limits.maxRemovals} 件）を超えたので、1 件も消さなかった`
      : null,
  ].filter((text) => text !== null);
  const reason = reasons.length > 0 ? reasons.join('。') : null;

  try {
    // 取り込みを書き終えた取得元だけが値を持つ。取り込まなかった項目や残した行がある回は値を消し、
    // 次も中身を取る（research.md の R9）
    const validators = reason === null ? (listing.validators ?? null) : null;
    await deps.activities.applyRefresh(source, plan, { fetchedAt: now, reason, validators });
  } catch (error) {
    return fail(deps, source, now, `書き込みに失敗した: ${messageOf(error)}`);
  }
  return {
    source,
    ok: true,
    added: plan.inserts.length,
    updated: plan.updates.length,
    removed: plan.deletes.length,
    keptOverLimit: removals.keptOverLimit,
    skippedWithoutDate: plan.skippedWithoutDate,
  };
};

/**
 * すべて取らない取得元で、一覧に無い行の URL を上限の本数まで取り直す（research.md の R6）。
 * 404 の行を消えたと確かめた行に、確かめた行のすべてを確かめた日時を書く行にする。確かめるのに
 * 失敗した行は消さない（FR-020）
 */
const checkGoneOf = async (
  deps: ActivityDeps,
  source: SourceName,
  stored: StoredItem[],
  listing: SourceListing,
  limits: RefreshLimits,
): Promise<{ gone: number[]; checked: number[] }> => {
  const checkGone = deps.goneCheckOf?.(source);
  if (listing.isComplete || !checkGone) return { gone: [], checked: [] };
  const rows = pickGoneChecks(stored, listing.items, limits.maxGoneChecks ?? 0);
  const results = await Promise.all(
    rows.map((row) => checkGone(row.url, limits).catch((): GoneCheck => 'unknown')),
  );
  return {
    gone: rows.filter((_, index) => results[index] === 'gone').map((row) => row.id),
    checked: rows.map((row) => row.id),
  };
};

/** 取得の結果に失敗を書く。それも失敗したら、両方の理由を返す */
const fail = async (
  deps: ActivityDeps,
  source: SourceName,
  now: string,
  reason: string,
): Promise<RefreshOutcome> => {
  try {
    await deps.activities.recordFetchFailure(source, now, reason);
    return { source, ok: false, reason };
  } catch (error) {
    return {
      source,
      ok: false,
      reason: `${reason}。取得の結果も書けなかった: ${messageOf(error)}`,
    };
  }
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
