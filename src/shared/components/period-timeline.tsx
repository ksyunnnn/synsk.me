import Link from 'next/link';
import type { ReactNode } from 'react';
import { DraftMark } from '@/shared/components/drafts';
import { cn } from '@/lib/utils';
import type { Period } from '@/shared/domain/period';

/**
 * 縦の時系列（#366 の「一覧の見せ方」）。新しいものを上に並べ、各行に共通の時間軸の上の棒を描く。
 * 同じ組織の職歴は、計算で求めた帯として上に並べる（表示だけ）。棒の位置で伝える関係は、
 * 行の文字（期間）でも読めるようにする（WCAG 2.1 SC 1.3.1）
 */

export type TimelineItem = {
  key: string;
  href: string;
  title: ReactNode;
  /** 題の横に添える属性（組織・種類など） */
  meta: string;
  period: Period;
  periodText: string;
  draftKey?: string;
  emphasized?: boolean;
};

export type TimelineBand = { key: string; label: string; period: Period };

const toTime = (day: string) => new Date(`${day}T00:00:00Z`).getTime();

export const PeriodTimeline = ({
  items,
  bands = [],
  selectedKey,
  today,
}: {
  items: TimelineItem[];
  bands?: TimelineBand[];
  selectedKey: string | null;
  /** 続いているものの終わりに使う日。`YYYY-MM-DD` */
  today: string;
}) => {
  const all = [...items.map((i) => i.period), ...bands.map((b) => b.period)];
  if (all.length === 0) return null;
  const start = Math.min(...all.map((p) => toTime(p.startedOn)));
  const end = Math.max(...all.map((p) => toTime(p.endedOn ?? today)));
  const span = Math.max(end - start, 1);
  const bar = (period: Period) => {
    const left = ((toTime(period.startedOn) - start) / span) * 100;
    const right = ((toTime(period.endedOn ?? today) - start) / span) * 100;
    return { left: `${left}%`, width: `${Math.max(right - left, 0.8)}%` };
  };
  const firstYear = new Date(start).getUTCFullYear();
  const lastYear = new Date(end).getUTCFullYear();
  const sorted = [...items].sort((a, b) => b.period.startedOn.localeCompare(a.period.startedOn));

  return (
    <div className="px-4">
      {/* 年の目盛り */}
      <div className="relative ml-14 h-5 text-caption text-muted-foreground" aria-hidden>
        {Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i).map((year) => {
          const at = ((Date.UTC(year, 0, 1) - start) / span) * 100;
          return at < 0 ? null : (
            <span key={year} className="absolute -translate-x-1/2" style={{ left: `${at}%` }}>
              {year}
            </span>
          );
        })}
      </div>
      {bands.length > 0 && (
        <ul aria-label="職歴（期間の重なりで求めたもの）" className="mb-3 flex flex-col gap-2 border-b border-border/60 pb-3">
          {bands.map((band) => (
            <li key={band.key} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-0">
              <span className="pt-0.5 text-caption text-muted-foreground">職歴</span>
              <div className="flex flex-col gap-1">
                <span className="truncate text-caption text-muted-foreground">{band.label}</span>
                <div className="relative h-2 rounded-full bg-muted">
                  <span
                    className="absolute inset-y-0 rounded-full bg-foreground/20"
                    style={bar(band.period)}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ol className="flex flex-col">
        {sorted.map((item, index) => {
          const year = item.period.startedOn.slice(0, 4);
          const showYear = index === 0 || sorted[index - 1].period.startedOn.slice(0, 4) !== year;
          const selected = item.key === selectedKey;
          return (
            <li
              key={item.key}
              className={cn(
                'relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-0 rounded-xl',
                selected ? 'bg-tint/12' : 'hover:bg-muted/70',
                item.emphasized === false && !selected && 'opacity-45',
              )}
            >
              <span className="pt-2 pl-1 text-caption font-medium text-muted-foreground tabular-nums">
                {showYear ? year : ''}
              </span>
              <div className="flex flex-col gap-1 py-2 pr-2">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Link
                    href={item.href}
                    scroll={false}
                    aria-current={selected ? 'true' : undefined}
                    className="text-small font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-ring"
                  >
                    {item.title}
                  </Link>
                  {item.draftKey && <DraftMark draftKey={item.draftKey} />}
                  <span className="text-caption text-muted-foreground">
                    {item.meta}・{item.periodText}
                  </span>
                </div>
                <div aria-hidden className="relative h-1.5 rounded-full bg-muted">
                  <span
                    className={cn(
                      'absolute inset-y-0 rounded-full',
                      selected || item.emphasized ? 'bg-tint' : 'bg-foreground/35',
                    )}
                    style={bar(item.period)}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
