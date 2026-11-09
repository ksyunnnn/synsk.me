import type { SourceName } from '@/features/activity/domain/fetched-item';

/**
 * 1 回の実行で取り直す取得元を選ぶ（specs/004-external-activity/research.md の R9、原則 2・4）。
 * 取り直したことの無い取得元を先に、次に最後に取り直した日時の古い順に、上限の数まで選ぶ。
 * 選ばなかった取得元は、次の回で先に選ばれる。取得の結果は成否を問わず日時を書くので、
 * 失敗し続ける取得元がほかの取得元の順番を奪わない。同じ日時は `candidates` の順にする
 */
export const pickSourcesForRun = <Name extends SourceName>(
  candidates: readonly Name[],
  fetchedAt: Readonly<Record<string, string>>,
  maxSources: number,
): Name[] =>
  candidates
    .map((name, order) => ({ name, order, at: fetchedAt[name] ?? '' }))
    .sort((a, b) => (a.at === b.at ? a.order - b.order : a.at < b.at ? -1 : 1))
    .slice(0, Math.max(0, maxSources))
    .map(({ name }) => name);
