import type { ReactNode } from 'react';
import type { Period } from '@/shared/domain/period';

/**
 * 訪問者の画面に出す期間。始まりと終わりの日を `<time>` で出す。使い手は 001 の実績のページ、
 * 002 の職務経歴書、005 の一覧。管理画面の文字列は `formatPeriod`（src/shared/domain/period.ts）
 */
export const PeriodText = ({
  period,
  ongoing,
}: {
  period: Period;
  /** 続いている期間の終わりの位置に出すもの。渡さなければ何も出さない */
  ongoing?: ReactNode;
}) => (
  <>
    <time dateTime={period.startedOn}>{period.startedOn}</time>
    {' 〜 '}
    {period.endedOn ? <time dateTime={period.endedOn}>{period.endedOn}</time> : ongoing}
  </>
);
