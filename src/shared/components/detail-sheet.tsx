'use client';

import { Drawer } from '@base-ui/react/drawer';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { PaneToggle } from '@/shared/components/dash-panes';
import { cn } from '@/lib/utils';

/**
 * Split view の右のペイン（シングル）。広い画面では一覧の右に並べる。狭い画面では、選んだ 1 件が
 * あるときだけ、一覧の上に半分の高さで止まるシートとして出し、後ろの一覧を見せる（#366 の
 * 「モバイルでは、詳細を半分の高さで止まるシートで出す」、HIG Sheets、Adopting Liquid Glass）。
 *
 * 狭い画面のシートの操作は Base UI の Drawer に任せる（docs/SOFTWARE_DESIGN.md の「見た目と操作を
 * 分ける」、https://base-ui.com/react/components/drawer）。後ろの一覧で別の行を選び続けられるよう、
 * モーダルにしない（HIG Sheets の nonmodal view）。開いたらシートの見出しへ、閉じたら開いた行へ
 * フォーカスを移す（WCAG 2.2 SC 2.4.3）。直しかけは閉じても `DraftProvider` に残るため、閉じる前に
 * 確かめない。JavaScript が動く前は、半分の高さで止まる CSS だけのシートを出す
 */

/** `globals.css` の `--breakpoint-lg`（976px）より狭い画面 */
const NARROW_QUERY = '(max-width: 975.98px)';

const subscribeNarrow = (onChange: () => void) => {
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

/** 狭い画面か。サーバーと、描画を引き継ぐ前は広い画面として描く */
const useNarrow = () =>
  useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );

/** 止まる高さ。半分（HIG Sheets の medium detent）と全体（large detent） */
const HALF = 0.55;
const FULL = 1;
const SNAP_POINTS = [HALF, FULL];

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
  const narrow = useNarrow();
  if (narrow)
    return (
      <NarrowSheet open={open} closeHref={closeHref} label={label}>
        {children}
      </NarrowSheet>
    );
  return (
    <section
      aria-label={label}
      className={cn(
        'min-w-0 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:rounded-3xl lg:bg-background lg:p-6 lg:shadow-none lg:backdrop-filter-none',
        open
          ? 'glass fixed inset-x-0 bottom-0 z-30 flex h-[55dvh] flex-col overflow-hidden rounded-t-3xl lg:static lg:h-auto lg:flex-none lg:overflow-y-auto lg:border-0'
          : 'hidden',
      )}
    >
      {open && (
        <div className="flex justify-end px-4 pt-2 lg:hidden">
          <Link
            href={closeHref}
            scroll={false}
            className="rounded-full px-3 py-1 text-small text-muted-foreground hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring"
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

/** 狭い画面のシート。開閉は URL の選んだ 1 件に従い、閉じたら選んだ 1 件を外した一覧へ移る */
const NarrowSheet = ({
  open,
  closeHref,
  label,
  children,
}: {
  open: boolean;
  closeHref: string;
  label: string;
  children: ReactNode;
}) => {
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);
  /** 閉じたときにフォーカスを戻す行。閉じると決めた時点で選んでいた行 */
  const openerRef = useRef<HTMLElement | null>(null);
  // URL が変わる前に閉じ始められるよう、開いているかを手元にも持つ
  const [shown, setShown] = useState(open);
  const [snapPoint, setSnapPoint] = useState<Drawer.Root.SnapPoint | null>(HALF);
  // URL の選んだ 1 件が変わったら、それに合わせる。開くときは半分の高さから始める
  // （https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes）
  const [previousOpen, setPreviousOpen] = useState(open);
  if (open !== previousOpen) {
    setPreviousOpen(open);
    setShown(open);
    if (open) setSnapPoint(HALF);
  }
  const expanded = snapPoint === FULL;

  return (
    <Drawer.Root
      open={shown}
      onOpenChange={(next) => {
        if (next) return;
        openerRef.current = document.querySelector<HTMLElement>('main a[aria-current="true"]');
        setShown(false);
        router.push(closeHref, { scroll: false });
      }}
      modal={false}
      disablePointerDismissal
      snapPoints={SNAP_POINTS}
      snapPoint={snapPoint}
      onSnapPointChange={setSnapPoint}
    >
      <Drawer.Portal>
        <Drawer.Viewport className="pointer-events-none fixed inset-0 z-30 flex items-end">
          <Drawer.Popup
            ref={popupRef}
            aria-label={label}
            initialFocus={() => {
              // 見出しを読み上げの起点にする。見出しが無ければ既定（最初の操作できる要素）
              const heading = popupRef.current?.querySelector<HTMLElement>('h2');
              if (!heading) return true;
              heading.tabIndex = -1;
              return heading;
            }}
            finalFocus={() => openerRef.current ?? true}
            className={cn(
              'pointer-events-auto flex h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-3xl outline-none',
              '[transform:translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))]',
              // 半分の高さでも本文の下端までスクロールできるよう、画面の外に出た分を下に空ける
              '[padding-bottom:max(0px,calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))]',
              'data-starting-style:[padding-bottom:0] data-ending-style:[padding-bottom:0]',
              'transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none data-swiping:select-none',
              'data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)]',
              // 広げると不透明にし、本文を読みやすくする（Adopting Liquid Glass）
              expanded ? 'bg-background' : 'glass',
            )}
          >
            <div className="relative flex shrink-0 items-center justify-center px-4 pt-2 pb-1">
              {/* つまみ。引いて高さを変え、押すと高さを切り替える（HIG Sheets の grabber） */}
              <button
                type="button"
                onClick={() => setSnapPoint(expanded ? HALF : FULL)}
                aria-expanded={expanded}
                className="flex h-6 w-16 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span aria-hidden className="h-1.5 w-10 rounded-full bg-foreground/25" />
                <span className="sr-only">
                  {expanded ? '半分の高さにする' : '全体の高さにする'}
                </span>
              </button>
              <Drawer.Close className="absolute top-2 right-3 rounded-full px-3 py-1 text-small text-muted-foreground hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring">
                閉じる
              </Drawer.Close>
            </div>
            <Drawer.Content className="min-h-0 flex-1 touch-auto overflow-y-auto overscroll-contain px-4 pb-6">
              {children}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
