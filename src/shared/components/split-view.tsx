import Link from 'next/link';
import type { ReactNode } from 'react';
import { CollectionPaneToggle, SplitPanes } from '@/shared/components/dash-panes';
import { DetailSheet } from '@/shared/components/detail-sheet';
import { DraftMark } from '@/shared/components/drafts';
import { cn } from '@/lib/utils';
import type { Period } from '@/shared/domain/period';

/**
 * 管理画面の Split view（HIG Split views、#366 の明文化の「3. アクションとインタラクション」）。
 * 左にオブジェクトのコレクション、右に選んだ 1 件のシングルを置く。選ぶと右が切り替わる。
 * 表と本文は不透明な面にし、ガラスはツールバーとシートにだけ使う
 */
export const SplitView = ({
  collection,
  detail,
  detailLabel,
  selected,
  closeHref,
  empty = '一覧から 1 件を選ぶと、ここに出ます',
}: {
  collection: ReactNode;
  /**
   * 選んだ 1 件のシングル。編集のフォームは `useDetailForm` を使い、保存のボタンをペインの上の行に
   * 任せる
   */
  detail: ReactNode;
  detailLabel: string;
  /** 選んだ 1 件があるか */
  selected: boolean;
  closeHref: string;
  empty?: string;
}) => (
  <SplitPanes
    collection={<div className="relative min-w-0 rounded-3xl bg-background pb-4">{collection}</div>}
    detail={
      <DetailSheet open={selected} closeHref={closeHref} label={detailLabel}>
        {selected ? detail : <p className="py-12 text-center text-muted-foreground">{empty}</p>}
      </DetailSheet>
    }
  />
);

/**
 * コレクションのツールバー。先頭に題と件数、末尾に主な操作を 1 つ置く。区画は 3 つまで
 * （HIG Toolbars）
 */
export const CollectionToolbar = ({
  title,
  headingLevel = 1,
  titleHidden = false,
  summary,
  children,
  action,
}: {
  title: string;
  /** 題の見出しの段。ほかの画面の中の区画（職務経歴書の中身など）では 2 にする */
  headingLevel?: 1 | 2;
  /** 題を画面に出さず、読み上げにだけ残す。タブなどで同じ名前がすでに見えている区画で使う */
  titleHidden?: boolean;
  /** 件数と、選んでいる条件。変わったら読み上げる */
  summary: string;
  /** 見せ方の切り替えや絞り込み。中ほどに置く */
  children?: ReactNode;
  action?: { href: string; label: string };
}) => (
  <div className="glass sticky top-4 z-10 m-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[28px] py-1.5 pr-1.5 pl-5">
    <CollectionPaneToggle />
    {headingLevel === 1 ? (
      <h1 className={titleHidden ? 'sr-only' : 'font-semibold'}>{title}</h1>
    ) : (
      <h2 className={titleHidden ? 'sr-only' : 'font-semibold'}>{title}</h2>
    )}
    <p aria-live="polite" className="text-small text-muted-foreground">
      {summary}
    </p>
    <div className="ml-auto flex flex-wrap items-center gap-2">
      {children}
      {action && (
        <Link
          href={action.href}
          className="rounded-full bg-tint px-4 py-1.5 text-small font-medium text-tint-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {action.label}
        </Link>
      )}
    </div>
  </div>
);

/**
 * 見せ方の切り替え（HIG Segmented controls: ツールバーでは Segmented control で切り替える）。
 * 切り替えは URL で持ち、選んだ 1 件と条件を保ったまま移る
 */
export const ViewSwitch = ({
  options,
}: {
  options: { href: string; label: string; current: boolean }[];
}) => (
  <nav aria-label="見せ方" className="flex rounded-full bg-foreground/6 p-0.5 text-small">
    {options.map((option) => (
      <Link
        key={option.label}
        href={option.href}
        scroll={false}
        aria-current={option.current ? 'page' : undefined}
        className={cn(
          'rounded-full px-3 py-1 focus-visible:outline-2 focus-visible:outline-ring',
          option.current ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground',
        )}
      >
        {option.label}
      </Link>
    ))}
  </nav>
);

export type CollectionColumn<Row> = {
  header: string;
  cell: (row: Row) => ReactNode;
  /** 折り返さない列 */
  nowrap?: boolean;
  /** 薄い文字で出す列 */
  muted?: boolean;
  /** 狭い画面では出さない列。題と期間だけで選べるようにする */
  wide?: boolean;
};

/**
 * コレクションの表。1 列めがシングルへのリンクで、行全体を押せる。選んだ行の強調を保つ
 * （HIG Split views）。直しかけがある行には印を出す
 */
export const CollectionTable = <Row,>({
  rows,
  columns,
  rowKey,
  rowHref,
  selectedKey,
  draftKey,
  emphasized,
  subtitle,
}: {
  rows: Row[];
  columns: [CollectionColumn<Row>, ...CollectionColumn<Row>[]];
  rowKey: (row: Row) => string;
  rowHref: (row: Row) => string;
  selectedKey: string | null;
  /** 直しかけを見分ける鍵。無ければ印を出さない */
  draftKey?: (row: Row) => string;
  /** 目立たせる行（絞り込みのスキルを持つ実績など）。無ければ目立たせない */
  emphasized?: (row: Row) => boolean;
  /** 1 列めの下に添える属性。列を減らし、題を読める幅に保つ */
  subtitle?: (row: Row) => ReactNode;
}) => {
  const [first, ...rest] = columns;
  return (
    <div className="overflow-x-auto px-2">
      <table className="w-full border-collapse text-small">
        <thead className="text-left text-caption text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={cn('px-3 py-2 font-medium', column.wide && 'hidden md:table-cell')}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = key === selectedKey;
            const dimmed = emphasized !== undefined && !emphasized(row);
            return (
              <tr
                key={key}
                className={cn(
                  'relative border-t border-border/60',
                  selected ? 'bg-tint/12' : 'hover:bg-muted/70',
                  dimmed && !selected && 'opacity-45',
                )}
              >
                <td className="px-3 py-2.5">
                  <Link
                    href={rowHref(row)}
                    scroll={false}
                    aria-current={selected ? 'true' : undefined}
                    className="font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
                  >
                    {first.cell(row)}
                  </Link>
                  {draftKey && (
                    <span className="ml-2">
                      <DraftMark draftKey={draftKey(row)} />
                    </span>
                  )}
                  {subtitle && (
                    <span className="mt-0.5 block text-caption text-muted-foreground">
                      {subtitle(row)}
                    </span>
                  )}
                </td>
                {rest.map((column) => (
                  <td
                    key={column.header}
                    className={cn(
                      'px-3 py-2.5',
                      column.nowrap && 'whitespace-nowrap tabular-nums',
                      column.muted && 'text-muted-foreground',
                      column.wide && 'hidden md:table-cell',
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/** 表の期間。始まりと終わりを 2 行に分け、題の列の幅を空ける。続いているものは「継続中」 */
export const PeriodLines = ({ period }: { period: Period }) => (
  <>
    <span className="block">{period.startedOn} 〜</span>
    <span className="block">{period.endedOn ?? '継続中'}</span>
  </>
);

/** 一覧が空のときの文 */
export const CollectionEmpty = ({ children }: { children: ReactNode }) => (
  <p className="px-5 py-8 text-muted-foreground">{children}</p>
);

/** シングルの見出し。直しかけの印を添える */
export const DetailHeading = ({
  title,
  draftKey,
  compact = false,
  children,
}: {
  title: ReactNode;
  draftKey?: string;
  /**
   * 見出しを本文の大きさの 2 行までにする。すぐ下の入力に同じ題があるフォームで、入力を
   * 押し下げないために使う（HIG Layout の「Order content by relative importance」）
   */
  compact?: boolean;
  /** 見出しの下に添える、計算で決まる関係など */
  children?: ReactNode;
}) => (
  <header className={cn('flex flex-col gap-2', compact ? 'pb-2' : 'pb-6')}>
    {draftKey && <DraftMark draftKey={draftKey} />}
    <h2 className={compact ? 'line-clamp-2 font-semibold' : 'text-heading-2'}>{title}</h2>
    {children}
  </header>
);

/** URL の検索の値に、1 つの値を足した（null なら外した）経路 */
export const withParam = (
  base: string,
  params: Record<string, string | null | undefined>,
  changes: Record<string, string | null>,
) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...changes })) {
    if (value) query.set(key, value);
  }
  return query.size === 0 ? base : `${base}?${query}`;
};
