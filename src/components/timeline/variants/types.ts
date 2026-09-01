import type { TimelineEntry } from '@/lib/timeline/types';

export const TIMELINE_VARIANTS = ['casual', 'chic', 'catnose'] as const;

export type TimelineVariant = (typeof TIMELINE_VARIANTS)[number];

export interface YearGroup {
  year: number;
  entries: TimelineEntry[];
}

export interface VariantProps {
  groups: YearGroup[];
  /** 相対表記の基準時刻。サーバとクライアントで同じ値を使い、再描画でずれないようにする。 */
  now: number;
}

export const VARIANT_LABEL: Record<TimelineVariant, string> = {
  casual: 'Casual',
  chic: 'Chic',
  catnose: 'Catnose',
};

export function isTimelineVariant(value: unknown): value is TimelineVariant {
  return (
    typeof value === 'string' && (TIMELINE_VARIANTS as readonly string[]).indexOf(value) !== -1
  );
}
