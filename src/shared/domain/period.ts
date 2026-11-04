/**
 * 職歴・実績・学歴の期間（specs/001-career-and-project/spec.md の FR-038・FR-039）。
 * 使い手は career・project・education と、002 の職務経歴書。
 *
 * 日付は `YYYY-MM-DD` の文字列のまま持ち、時刻帯を持たない。経験年数と期間の重なりの
 * 計算もここに置くが、数え方が決まるまで書かない（specs/001-career-and-project/plan.md の U6）。
 */

/** 暦の日付。`YYYY-MM-DD` の形で、実在する日 */
export type CalendarDate = string & { readonly __brand: 'CalendarDate' };

export type Period = {
  startedOn: CalendarDate;
  /** 空なら続いている */
  endedOn: CalendarDate | null;
};

export type PeriodError = 'invalid-started-on' | 'invalid-ended-on' | 'ended-before-started';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `YYYY-MM-DD` の形で実在する日なら `CalendarDate` を、そうでなければ null を返す。
 * 2 月 30 日のような実在しない日を拒む。migration の CHECK（`strftime('%Y-%m-%d', x) IS x`）と
 * 同じ日を通す
 */
export const parseCalendarDate = (value: string): CalendarDate | null => {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isReal ? (value as CalendarDate) : null;
};

/**
 * 入力の始まりの日と終わりの日から期間を作る。終わりの日が空文字か null なら、続いている
 * 期間にする。終わりの日が始まりの日と同じ日は通し、前の日は拒む（FR-039）
 */
export const toPeriod = (
  startedOn: string,
  endedOn: string | null,
): { ok: true; period: Period } | { ok: false; error: PeriodError } => {
  const started = parseCalendarDate(startedOn);
  if (!started) return { ok: false, error: 'invalid-started-on' };
  if (endedOn === null || endedOn === '')
    return { ok: true, period: { startedOn: started, endedOn: null } };
  const ended = parseCalendarDate(endedOn);
  if (!ended) return { ok: false, error: 'invalid-ended-on' };
  // `YYYY-MM-DD` は文字列の順と日付の順が一致する
  if (ended < started) return { ok: false, error: 'ended-before-started' };
  return { ok: true, period: { startedOn: started, endedOn: ended } };
};
