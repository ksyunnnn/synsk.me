'use client';

import { useSearchParams } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 管理画面の Sidebar と、Split view の詳細の列を、利用者が隠せるようにする。既定は表示する
 * （HIG Sidebars の「Consider letting people hide the sidebar」「Avoid hiding the sidebar by
 * default」、HIG Split views の「Consider letting people hide a pane」）。時系列のように横の幅を
 * 使う見せ方で、一覧の列を広げるために使う。隠すのは広い画面だけで、狭い画面の並びは変えない
 */

type Pane = 'sidebar' | 'detail';

const PanesContext = createContext<{
  hidden: Record<Pane, boolean>;
  setHidden: (pane: Pane, value: boolean) => void;
}>({ hidden: { sidebar: false, detail: false }, setHidden: () => {} });

const LABELS: Record<Pane, { hide: string; show: string }> = {
  sidebar: { hide: 'サイドバーを隠す', show: 'サイドバーを表示' },
  detail: { hide: '詳細を隠す', show: '詳細を表示' },
};

/** 隠す・表示するボタン。いまの状態の逆を行う */
export const PaneToggle = ({ pane, className }: { pane: Pane; className?: string }) => {
  const { hidden, setHidden } = useContext(PanesContext);
  const label = hidden[pane] ? LABELS[pane].show : LABELS[pane].hide;
  return (
    <button
      type="button"
      onClick={() => setHidden(pane, !hidden[pane])}
      aria-label={label}
      title={label}
      className={cn(
        'size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3" y="4" width="18" height="16" rx="3" />
        {pane === 'sidebar' ? (
          <line x1="9" y1="4" x2="9" y2="20" />
        ) : (
          <line x1="15" y1="4" x2="15" y2="20" />
        )}
      </svg>
    </button>
  );
};

/** 管理画面の枠。Sidebar を隠しているときは、一覧の列が全体の幅を使う */
export const DashPanes = ({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) => {
  const [hidden, setState] = useState<Record<Pane, boolean>>({ sidebar: false, detail: false });
  const setHidden = (pane: Pane, value: boolean) =>
    setState((current) => ({ ...current, [pane]: value }));
  return (
    <PanesContext value={{ hidden, setHidden }}>
      <div
        className={cn(
          'mx-auto grid max-w-[1440px] gap-4 p-4',
          !hidden.sidebar && 'md:grid-cols-[220px_minmax(0,1fr)]',
        )}
      >
        <div className={cn('contents', hidden.sidebar && 'md:hidden')}>{sidebar}</div>
        <div className="min-w-0">
          {hidden.sidebar && (
            <div className="mb-2 hidden md:flex">
              <PaneToggle pane="sidebar" className="flex bg-background" />
            </div>
          )}
          {children}
        </div>
      </div>
    </PanesContext>
  );
};

/**
 * Split view の並び。詳細の列を隠しているときは、一覧の列が全体の幅を使う。別の 1 件を選んだら、
 * 詳細の列を表示に戻す（選んだ結果が見えないままにしない）
 */
export const SplitPanes = ({
  collection,
  detail,
}: {
  collection: ReactNode;
  detail: ReactNode;
}) => {
  const { hidden, setHidden } = useContext(PanesContext);
  const selected = useSearchParams().get('selected');
  useEffect(() => {
    if (selected) setHidden('detail', false);
    // setHidden は描画のたびに作り直すので、選んだ 1 件が変わったときだけ動かす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  return (
    <main
      className={cn(
        'grid gap-4',
        !hidden.detail && 'lg:grid-cols-[minmax(0,1fr)_minmax(380px,560px)]',
      )}
    >
      {hidden.detail && (
        <div className="hidden justify-end lg:flex">
          <PaneToggle pane="detail" className="flex bg-background" />
        </div>
      )}
      {collection}
      <div className={cn('contents', hidden.detail && 'lg:hidden')}>{detail}</div>
    </main>
  );
};
