'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { PaneToggle } from '@/shared/components/dash-panes';
import { cn } from '@/lib/utils';

/**
 * Split view の右のペイン（シングル）。広い画面では一覧の右に並べる。狭い画面では、選んだ 1 件が
 * あるときだけ、一覧の上に半分の高さで止まるシートとして出し、後ろの一覧を見せる。つまみで全体の
 * 高さまで広げられ、広げると不透明にする（#366 の「モバイルでは、詳細を半分の高さで止まる
 * シートで出す」、HIG Sheets、Adopting Liquid Glass）
 */
export const DetailSheet = ({
  open,
  closeHref,
  label,
  children,
}: {
  /** 選んだ 1 件があるか */
  open: boolean;
  /** 閉じたときの行き先。選んだ 1 件を外した一覧 */
  closeHref: string;
  label: string;
  children: ReactNode;
}) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <section
      aria-label={label}
      className={cn(
        'min-w-0 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:rounded-3xl lg:bg-background lg:p-6 lg:shadow-none lg:backdrop-filter-none',
        open
          ? cn(
              'fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-3xl transition-[height,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none lg:static lg:h-auto lg:flex-none lg:overflow-y-auto',
              expanded ? 'h-[calc(100dvh-1rem)] bg-background' : 'glass h-[55dvh] lg:border-0',
            )
          : 'hidden',
      )}
    >
      {open && (
        <div className="flex items-center justify-between gap-2 px-4 pt-2 lg:hidden">
          {/* つまみ。押すと高さを切り替える（HIG Sheets の grabber） */}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="mx-auto flex h-6 w-16 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-foreground/25" />
            <span className="sr-only">{expanded ? '半分の高さにする' : '全体の高さにする'}</span>
          </button>
          <Link
            href={closeHref}
            scroll={false}
            className="absolute top-2 right-3 rounded-full px-3 py-1 text-small text-muted-foreground hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring"
          >
            閉じる
          </Link>
        </div>
      )}
      {/* 広い画面では、詳細の列を隠せる（HIG Split views） */}
      <div className="-mt-3 -mr-3 hidden justify-end lg:flex">
        <PaneToggle pane="detail" className="flex" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 lg:overflow-visible lg:p-0">
        {children}
      </div>
    </section>
  );
};
