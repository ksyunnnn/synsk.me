import type { CalendarDate } from '@/shared/domain/period';

/**
 * オーナーが入れる暦の日付と、`activity.published_at`（UTC の日時）の読み替え
 * （specs/004-external-activity/research.md の R9）。日本時間（Asia/Tokyo）のその日の 0 時を
 * UTC の日時で持つ。日本時間は夏時間を持たず、UTC より 9 時間進む
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 暦の日付を、日本時間のその日の 0 時の UTC の日時にする。例: 2026-01-02 → 2026-01-01T15:00:00.000Z */
export const calendarDateToPublishedAt = (date: CalendarDate): string =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) - JST_OFFSET_MS).toISOString();

/** UTC の日時を、日本時間の暦の日付にする */
export const publishedAtToCalendarDate = (publishedAt: string): CalendarDate =>
  new Date(Date.parse(publishedAt) + JST_OFFSET_MS).toISOString().slice(0, 10) as CalendarDate;
