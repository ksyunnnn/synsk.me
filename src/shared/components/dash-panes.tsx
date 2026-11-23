'use client';

import { Toggle } from '@base-ui/react/toggle';
import { useSearchParams } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 管理画面の Sidebar と、Split view の詳細の列を、利用者が隠せるようにする。既定は表示する
 * （HIG Sidebars の「Consider letting people hide the sidebar」「Avoid hiding the sidebar by
 * default」、HIG Split views の「Consider letting people hide a pane」）。時系列のように横の幅を
 * 使う見せ方で、一覧の列を広げるために使う。隠すのは広い画面だけで、狭い画面の並びは変えない
 */

type Pane = 'sidebar' | 'detail';

/**
 * 狭い画面で、全体の高さのシートが Sidebar と一覧を覆っているか。覆っている間は、どちらも
 * `inert` にする（WCAG 2.2 SC 2.4.11）。シート（`DetailSheet`）が知らせる
 */
export const CoverContext = createContext<{
  covered: boolean;
  setCovered: (covered: boolean) => void;
}>({ covered: false, setCovered: () => {} });

const PanesContext = createContext<{
  hidden: Record<Pane, boolean>;
  setHidden: (pane: Pane, value: boolean) => void;
}>({ hidden: { sidebar: false, detail: false }, setHidden: () => {} });

/** 押した状態が「隠している」にあたる。状態は押した状態（`aria-pressed`）で伝え、名前は変えない */
const LABELS: Record<Pane, string> = {
  sidebar: 'サイドバーを隠す',
  detail: '詳細を隠す',
};

/**
 * 隠すかを切り替えるボタン。列の表示を切り替えるだけなので、Base UI の Toggle（押した状態を持つ
 * ボタン）にする（https://base-ui.com/react/components/toggle）
 */
export const PaneToggle = ({ pane, className }: { pane: Pane; className?: string }) => {
  const { hidden, setHidden } = useContext(PanesContext);
  return (
    <Toggle
      pressed={hidden[pane]}
      onPressedChange={(pressed) => setHidden(pane, pressed)}
      aria-label={LABELS[pane]}
      title={LABELS[pane]}
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
    </Toggle>
  );
};

/** 管理画面の枠。Sidebar を隠しているときは、一覧の列が全体の幅を使う */
export const DashPanes = ({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) => {
  const [hidden, setState] = useState<Record<Pane, boolean>>({ sidebar: false, detail: false });
  const setHidden = (pane: Pane, value: boolean) =>
    setState((current) => ({ ...current, [pane]: value }));
  const [covered, setCovered] = useState(false);
  const cover = useMemo(() => ({ covered, setCovered }), [covered]);
  return (
    <PanesContext value={{ hidden, setHidden }}>
      <CoverContext value={cover}>
        <div
          className={cn(
            'mx-auto grid max-w-[1440px] gap-4 p-4',
            !hidden.sidebar && 'md:grid-cols-[220px_minmax(0,1fr)]',
          )}
        >
          <div className={cn('contents', hidden.sidebar && 'md:hidden')} inert={covered}>
            {sidebar}
          </div>
          <div className="min-w-0">
            {hidden.sidebar && (
              <div className="mb-2 hidden md:flex">
                <PaneToggle pane="sidebar" className="flex bg-background" />
              </div>
            )}
            {children}
          </div>
        </div>
      </CoverContext>
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
  const { covered } = useContext(CoverContext);
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
      <div className="contents" inert={covered}>
        {collection}
      </div>
      <div className={cn('contents', hidden.detail && 'lg:hidden')}>{detail}</div>
    </main>
  );
};
