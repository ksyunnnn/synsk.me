import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { DraftMark } from '@/shared/components/drafts';
import { cn } from '@/lib/utils';
import type { Period } from '@/shared/domain/period';

/**
 * 縦の時系列（#366 の「一覧の見せ方」）。時間の軸は縦の 1 本にし、上を新しくする。各項目は
 * 期間の長さぶんの縦の線で描き、期間が重なる線は細い列に並べる。題・属性・期間は線の右の
 * 1 本の列にまとめ、線の始まりの高さに置いて細い線で結ぶ。重なるときは下へずらす。
 *
 * - 並びとフォーカスの順は、始まりの新しい順（WCAG 2.1 SC 1.3.2、HIG Charts）
 * - 軸の範囲は、表示している項目の期間に合わせる（HIG Charts の dynamic range）
 * - 押せる高さは 28px 以上（HIG Accessibility の macOS の既定の大きさ、WCAG 2.2 SC 2.5.8）
 * - 選んだ 1 件は、色に加えて枠と「選択中」の文字で示す（HIG Accessibility、WCAG 2.1 SC 1.4.1）
 * - 線の位置で伝える期間は、文字でも読めるようにする（WCAG 2.1 SC 1.3.1）
 */

export type TimelineItem = {
  key: string;
  href: string;
  title: ReactNode;
  /** 題の下に添える属性（組織・種類など） */
  meta: string;
  period: Period;
  periodText: string;
  draftKey?: string;
  emphasized?: boolean;
};

/** 1 か月の高さ（px） */
const MONTH = 14;
/** 題の列の左端。線の列と年の目盛りの幅は、狭い画面で細くする（CSS 変数 `--lane`・`--years`） */
const LABEL_LEFT = 'calc(var(--years) + var(--lanes) * var(--lane) + 24px)';
/** 線と題の間（px）。結ぶ線を引く */
const GAP = 24;
/** 題の 1 件の高さ（px）。題 1 行と属性・期間 1 行。押せる高さの下限 28px を超える */
const LABEL = 48;

/** `YYYY-MM-DD` を、月の通し番号にする */
const toMonth = (day: string) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1;

export const PeriodTimeline = ({
  items,
  selectedKey,
  today,
}: {
  items: TimelineItem[];
  selectedKey: string | null;
  /** 続いているものの終わりに使う日。`YYYY-MM-DD` */
  today: string;
}) => {
  if (items.length === 0) return null;
  const spans = items.map((item) => ({
    item,
    start: toMonth(item.period.startedOn),
    end: toMonth(item.period.endedOn ?? today),
  }));
  const first = Math.min(...spans.map((s) => s.start));
  const last = Math.max(...spans.map((s) => s.end));
  const y = (month: number) => (last - month) * MONTH;

  // 期間が重なる線は、別の列に置く（古いものから順に、空いている最初の列へ）
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    let lane = laneEnds.findIndex((end) => end <= span.start);
    if (lane < 0) lane = laneEnds.push(span.end) - 1;
    else laneEnds[lane] = span.end;
    lanes.set(span.item.key, lane);
  }

  // 題は始まりの新しい順に、始まりの高さへ置く。上の題と重なるときは下へずらす
  const placed = [...spans]
    .sort((a, b) => b.start - a.start)
    .map((span) => ({
      ...span,
      lane: lanes.get(span.item.key) ?? 0,
      barTop: y(span.end),
      barHeight: Math.max((span.end - span.start) * MONTH, 4),
      anchor: y(span.start),
      labelTop: 0,
    }));
  for (const [index, entry] of placed.entries()) {
    const above = index === 0 ? -Infinity : placed[index - 1].labelTop + LABEL + 4;
    entry.labelTop = Math.max(entry.anchor - LABEL / 2, above, 0);
  }
  const height = Math.max(placed[placed.length - 1].labelTop + LABEL, y(first)) + 8;
  const firstYear = Math.floor(first / 12) + 1;
  const lastYear = Math.floor(last / 12);
  const years = Array.from(
    { length: Math.max(lastYear - firstYear + 1, 0) },
    (_, i) => lastYear - i,
  );

  return (
    <div
      className="relative mx-4 mt-3 mb-2 [--lane:6px] [--years:40px] md:[--lane:10px] md:[--years:56px]"
      style={{ height, '--lanes': laneEnds.length } as CSSProperties}
    >
      {/* 年の目盛り。その年の 1 月の位置に線を引く */}
      {years.map((year) => (
        <div
          key={year}
          aria-hidden
          className="absolute border-t border-border/70"
          style={{ top: y(year * 12), left: 0, width: `calc(${LABEL_LEFT} - ${GAP / 2}px)` }}
        >
          <span className="absolute -top-2.5 left-0 bg-background pr-2 text-caption font-medium text-muted-foreground tabular-nums">
            {year}
          </span>
        </div>
      ))}
      {/* 線と、線の始まりから題への結び（横・縦・横の 3 本） */}
      {placed.map(({ item, lane, barTop, barHeight, anchor, labelTop }) => {
        const selected = item.key === selectedKey;
        const x = `(var(--years) + ${lane} * var(--lane))`;
        const elbow = `(${LABEL_LEFT} - ${GAP / 2}px)`;
        const center = labelTop + LABEL / 2;
        return (
          <div
            key={item.key}
            aria-hidden
            className={cn(
              'pointer-events-none',
              selected || item.emphasized ? 'text-tint' : 'text-foreground/35',
              item.emphasized === false && !selected && 'opacity-45',
            )}
          >
            <span
              className="absolute rounded-full bg-current"
              style={{
                top: barTop,
                height: barHeight,
                left: `calc(${x} - ${selected ? 1 : 0}px)`,
                width: selected ? 6 : 4,
              }}
            />
            <span
              className={cn('absolute h-px bg-current', !selected && 'opacity-60')}
              style={{
                top: anchor,
                left: `calc(${x} + 4px)`,
                width: `calc(${elbow} - ${x} - 4px)`,
              }}
            />
            <span
              className={cn('absolute w-px bg-current', !selected && 'opacity-60')}
              style={{
                top: Math.min(anchor, center),
                height: Math.abs(center - anchor) + 1,
                left: `calc(${elbow})`,
              }}
            />
            <span
              className={cn('absolute h-px bg-current', !selected && 'opacity-60')}
              style={{ top: center, left: `calc(${elbow})`, width: GAP / 2 - 4 }}
            />
          </div>
        );
      })}
      <ol aria-label="新しい順">
        {placed.map(({ item, labelTop }) => {
          const selected = item.key === selectedKey;
          return (
            <li
              key={item.key}
              className={cn(
                'absolute right-0 flex flex-col justify-center rounded-lg px-2',
                selected ? 'bg-tint/12 ring-2 ring-tint ring-inset' : 'hover:bg-muted/70',
                item.emphasized === false && !selected && 'opacity-45',
              )}
              style={{ top: labelTop, height: LABEL, left: LABEL_LEFT }}
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <Link
                  href={item.href}
                  scroll={false}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'truncate text-small after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-ring',
                    selected ? 'font-bold' : 'font-medium',
                  )}
                >
                  {item.title}
                </Link>
                {selected && (
                  <span className="shrink-0 text-caption font-medium text-tint">
                    <span aria-hidden>✓ </span>選択中
                  </span>
                )}
                {item.draftKey && <DraftMark draftKey={item.draftKey} />}
              </div>
              <span className="truncate text-caption text-muted-foreground">
                {item.meta}・{item.periodText}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
