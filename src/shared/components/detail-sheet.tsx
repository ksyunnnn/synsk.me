'use client';

import { Drawer } from '@base-ui/react/drawer';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { CoverContext, PaneToggle } from '@/shared/components/dash-panes';
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
 * 確かめない。
 *
 * `?selected=` の URL を直接開いたときは、サーバーが描いた全体の高さの CSS だけのシートを、閉じる
 * まで使い続ける。Drawer に替えると詳細のフォームを描き直し、JavaScript が動く前に打った入力が
 * 消えるため。閉じた後に一覧で行を選ぶと、Drawer で半分の高さから開く
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

const subscribeNothing = () => () => {};

/** サーバーが描いた HTML を引き継いでいる描画か。引き継いだ後に置いた部品では false */
const useHydrating = () =>
  useSyncExternalStore(
    subscribeNothing,
    () => false,
    () => true,
  );

/** 閉じた後にフォーカスを戻す行。閉じると決めた時点で選んでいた行 */
const selectedRow = () => document.querySelector<HTMLElement>('main a[aria-current="true"]');

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
  const hydrating = useHydrating();
  const { setCovered } = useContext(CoverContext);
  const sectionRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // URL を直接開いて、選んだ 1 件があったか。閉じるまで CSS だけのシートを使い続ける
  const [direct, setDirect] = useState(open && hydrating);
  if (direct && !open) setDirect(false);
  // 狭い画面で全体の高さのシートが Sidebar と一覧を覆う間は、覆われた行へフォーカスが移らないようにする
  // （WCAG 2.2 SC 2.4.11）
  const covering = narrow && direct;
  useEffect(() => {
    setCovered(covering);
  }, [covering, setCovered]);
  // 直接開いたときは、描画を引き継いだ後に見出しへフォーカスを移す（WCAG 2.2 SC 2.4.3）
  const focused = useRef(false);
  useEffect(() => {
    if (!covering || focused.current) return;
    focused.current = true;
    const heading = sectionRef.current?.querySelector<HTMLElement>('h2');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }, [covering]);
  // 閉じたら、選んでいた行へフォーカスを戻す
  useEffect(() => {
    if (open || !openerRef.current) return;
    openerRef.current.focus();
    openerRef.current = null;
  }, [open]);
  if (narrow && !direct)
    return (
      <NarrowSheet open={open} closeHref={closeHref} label={label}>
        {children}
      </NarrowSheet>
    );
  return (
    <section
      ref={sectionRef}
      aria-label={label}
      className={cn(
        'min-w-0 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:rounded-3xl lg:bg-background lg:p-6 lg:shadow-none lg:backdrop-filter-none',
        // 狭い画面でこの形が出るのは、URL を直接開いたときだけ。全体の高さで一覧を覆う
        open
          ? 'fixed inset-x-0 bottom-0 z-30 flex h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-t-3xl bg-background lg:static lg:h-auto lg:flex-none lg:overflow-y-auto lg:border-0'
          : 'hidden',
      )}
    >
      {open && (
        <div className="relative flex shrink-0 items-center justify-center px-4 pt-2 pb-1 lg:hidden">
          <span aria-hidden className="h-6 w-16" />
          <Link
            href={closeHref}
            scroll={false}
            onClick={() => {
              openerRef.current = selectedRow();
              // 戻す先の行にフォーカスを移せるよう、移る前に一覧の inert を外す
              setCovered(false);
            }}
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
  // 全体の高さの間は、覆われた Sidebar と一覧を inert にする（WCAG 2.2 SC 2.4.11）。半分の高さでは
  // モーダルにしないため、後ろも操作できる
  const { setCovered } = useContext(CoverContext);
  const covering = shown && expanded;
  useEffect(() => {
    setCovered(covering);
    return () => setCovered(false);
  }, [covering, setCovered]);

  return (
    <Drawer.Root
      open={shown}
      onOpenChange={(next) => {
        if (next) return;
        openerRef.current = selectedRow();
        // 戻す先の行にフォーカスを移せるよう、閉じ始める前に inert を外す
        setCovered(false);
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
