import { describe, expect, it } from 'vitest';
import { parseCalendarDate, toPeriod } from '@/shared/domain/period';

/**
 * 期間の日付の形と前後（specs/001-career-and-project/spec.md の FR-038・FR-039）。
 * 経験年数と重なりの計算は、数え方が決まってから確かめる（plan.md の U6）。
 */

describe('parseCalendarDate', () => {
  it.each(['2026-11-04', '2024-02-29', '2000-01-01'])('%s を通す', (value) => {
    expect(parseCalendarDate(value)).toBe(value);
  });

  it.each([
    ['実在しない日', '2026-02-30'],
    ['うるう年でない 2 月 29 日', '2025-02-29'],
    ['13 月', '2026-13-01'],
    ['桁が足りない', '2026-1-4'],
    ['区切りが違う', '2026/11/04'],
    ['時刻つき', '2026-11-04T00:00:00Z'],
    ['空', ''],
  ])('%s（%s）を拒む', (_, value) => {
    expect(parseCalendarDate(value)).toBeNull();
  });
});

describe('toPeriod', () => {
  it.each([null, ''])('終わりの日が空（%j）なら、続いている期間にする', (endedOn) => {
    expect(toPeriod('2026-04-01', endedOn)).toEqual({
      ok: true,
      period: { startedOn: '2026-04-01', endedOn: null },
    });
  });

  it('始まりの日と同じ終わりの日を通す', () => {
    expect(toPeriod('2026-04-01', '2026-04-01')).toEqual({
      ok: true,
      period: { startedOn: '2026-04-01', endedOn: '2026-04-01' },
    });
  });

  it('始まりの日より後の終わりの日を通す', () => {
    expect(toPeriod('2026-04-01', '2027-03-31')).toMatchObject({ ok: true });
  });

  it('始まりの日より前の終わりの日を拒む', () => {
    expect(toPeriod('2026-04-01', '2026-03-31')).toEqual({
      ok: false,
      error: 'ended-before-started',
    });
  });

  it('読めない始まりの日を拒む', () => {
    expect(toPeriod('2026-02-30', null)).toEqual({ ok: false, error: 'invalid-started-on' });
  });

  it('読めない終わりの日を拒む', () => {
    expect(toPeriod('2026-04-01', '2026-04-31')).toEqual({ ok: false, error: 'invalid-ended-on' });
  });
});
