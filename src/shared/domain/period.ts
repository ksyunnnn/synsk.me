/**
 * 職歴・実績・学歴の期間（specs/001-career-and-project/spec.md の FR-038・FR-039）。
 * 使い手は career・project・education と、002 の職務経歴書。
 *
 * 日付は `YYYY-MM-DD` の文字列のまま持ち、時刻帯を持たない。経験年数の計算（spec の FR-033）と、
 * 職歴と実績の期間の重なりの判定（FR-017・FR-035）もここに置く。
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

/*
 * 経験年数（spec の FR-033）。月を単位に数え、日付の日の部分を使わない。各期間の始まりの月から
 * 終わりの月までを両端を含めて数え、終わりの日が空なら日本時間の今月までを数える。期間が
 * 重なる月は 1 回だけ数える。例: 2020-04-01〜2022-03-31 は 24 か月
 */

/** 月の通し番号。年 × 12 + 月 − 1 */
type MonthIndex = number;

const monthIndexOf = (date: CalendarDate): MonthIndex =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;

/** 月の区切りに使う時刻帯（FR-033） */
const EXPERIENCE_TIME_ZONE = 'Asia/Tokyo';

/** `now` の時点の、日本時間の月の通し番号 */
const currentMonthIndex = (now: Date): MonthIndex => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EXPERIENCE_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const valueOf = (type: 'year' | 'month') =>
    Number(parts.find((part) => part.type === type)?.value);
  return valueOf('year') * 12 + valueOf('month') - 1;
};

/**
 * 期間の並びから経験の月数を求める。期間を月の範囲にし、始まりの月で並べ、重なるか
 * 続く範囲をつないでから、範囲ごとの月数を足す。今月より後に始まる期間は数えない
 */
export const countExperienceMonths = (periods: readonly Period[], now: Date): number => {
  const thisMonth = currentMonthIndex(now);
  const ranges = periods
    .map((period) => ({
      start: monthIndexOf(period.startedOn),
      end: period.endedOn === null ? thisMonth : monthIndexOf(period.endedOn),
    }))
    .filter((range) => range.start <= range.end)
    .sort((a, b) => a.start - b.start);

  let total = 0;
  let current: { start: MonthIndex; end: MonthIndex } | null = null;
  for (const range of ranges) {
    if (current && range.start <= current.end + 1) {
      current.end = Math.max(current.end, range.end);
      continue;
    }
    if (current) total += current.end - current.start + 1;
    current = { ...range };
  }
  if (current) total += current.end - current.start + 1;
  return total;
};

/** 月数を年と月に分ける。5 年 11 か月は 71 */
export const toYearsAndMonths = (months: number): { years: number; months: number } => ({
  years: Math.floor(months / 12),
  months: months % 12,
});

/**
 * 2 つの期間が重なるか（spec の FR-017・FR-035）。期間は両端の日を含む（FR-039 は始まりと終わりが
 * 同じ日の期間を許す）ため、一方の終わりの日ともう一方の始まりの日が同じ日なら重なるとみなす。
 * 終わりの日が空の期間は終わらない。
 *
 * 端の日だけ接するときの扱いは specs/001-career-and-project/plan.md の U6 の残りで、オーナーの決定が
 * 無い。決まるまでの既定として、期間が両端を含むことに合わせて重なるとする。日付の比較は文字列の
 * 比較で足りる（`YYYY-MM-DD` は文字列の順と日付の順が一致する）
 */
export const periodsOverlap = (a: Period, b: Period): boolean =>
  (b.endedOn === null || a.startedOn <= b.endedOn) &&
  (a.endedOn === null || b.startedOn <= a.endedOn);
