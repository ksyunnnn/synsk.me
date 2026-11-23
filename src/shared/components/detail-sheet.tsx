'use client';

import { Drawer } from '@base-ui/react/drawer';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import { CoverContext, PaneToggle } from '@/shared/components/dash-panes';
import { SubmitButton, useReportPending } from '@/shared/components/submit-button';
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
 * 消えるため。閉じた後に一覧で行を選ぶと、Drawer で半分の高さから開く。
 *
 * 主な操作（保存する）は、ペインの上端の末尾に置き、スクロールしても見えるようにする（HIG Layout の
 * 「Avoid placing controls or critical information at the bottom of a window」、HIG Toolbars の
 * 主な操作は 1 つで末尾）。広い画面ではペインの上の行、狭い画面ではシートの上の行に置く。
 * ペインが詳細のフォームの id を決め、`useDetailForm` でフォームに渡す。画面ごとに id を配線しない
 */

/** ペインが決めた、詳細のフォームの id。ペインの外では無い */
const DetailFormContext = createContext<string | undefined>(undefined);

/** 詳細のフォームに付ける印。ペインの上の行の保存のボタンは、この印のフォームがあるときだけ出る */
const DETAIL_FORM_ATTRIBUTE = 'data-detail-form';

/**
 * 詳細のペインに置かれたフォームが、`<form>` に広げる属性。ペインの外では undefined を返し、
 * フォームは自分の下端に保存のボタンを置く。ペインの中では、上の行のボタンが `form` 属性で
 * この id を指して送る（JavaScript なしでも送れる）。送っているかは、引数の値で上の行のボタンに
 * 知らせる。値は `useActionState` の 3 つめの値を渡す
 */
export const useDetailForm = (pending: boolean) => {
  const id = useContext(DetailFormContext);
  useReportPending(id, pending);
  return id === undefined ? undefined : { id, [DETAIL_FORM_ATTRIBUTE]: '' };
};

/**
 * ペインの上の行の保存のボタン。フォームの外にあるので、`form` 属性でフォームの id を指して送る。
 * 詳細のフォームはどれも編集のフォームなので、文言は「保存する」に固定する。
 * 見た目は一覧のツールバーの主な操作と同じにする。詳細が無い（「この実績はありません」など）ときは
 * 出さない。判定は CSS の `:has()` で行い、JavaScript が動く前から合わせる
 */
const DetailSubmit = ({ form }: { form: string }) => (
  <SubmitButton
    form={form}
    className="hidden rounded-full bg-tint px-4 py-1.5 text-small font-medium text-tint-foreground group-has-[[data-detail-form]]/detail:block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
  >
    保存する
  </SubmitButton>
);

/**
 * 狭い画面の上の行で、保存のボタンが出るときの形。ボタンと同じく、詳細のフォームがあるかを CSS の
 * `:has()` で見る。フォームが無い（「この実績はありません」など）ときは、閉じるを末尾に置き、高さを取らない
 */
const SUBMIT_ROW_HEIGHT = 'group-has-[[data-detail-form]]/detail:min-h-12';
const CLOSE_BESIDE_SUBMIT =
  'right-3 group-has-[[data-detail-form]]/detail:right-auto group-has-[[data-detail-form]]/detail:left-3';

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

/**
 * 広い画面で、ペインの上端から画面の下端までの高さに収める。ペインより上に見出しやタブがある画面
 * （職務経歴書の中身）で、ペインの下端が画面の外に出て、末尾が隠れないようにする。上端の位置は
 * スクロールで変わる（一覧が長いとペインは留まる）ので、スクロールのたびに測り直す。列を隠すと
 * 上に戻すボタンの行が足され、スクロールしなくても上端が下がるので、ページの大きさが変わったときも
 * 測り直す
 */
const useFitToViewport = (ref: RefObject<HTMLElement | null>, active: boolean) => {
  useEffect(() => {
    const element = ref.current;
    if (!active || !element) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const top = Math.max(element.getBoundingClientRect().top, 0);
      element.style.setProperty('--pane-top', `${top}px`);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const resized = new ResizeObserver(schedule);
    resized.observe(document.body);
    const main = element.closest('main');
    if (main) resized.observe(main);
    return () => {
      resized.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      element.style.removeProperty('--pane-top');
    };
  }, [ref, active]);
};

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
  const formId = useId();
  const actions = open ? <DetailSubmit form={formId} /> : undefined;
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
  useFitToViewport(sectionRef, open && !narrow);
  if (narrow && !direct)
    return (
      <NarrowSheet open={open} closeHref={closeHref} label={label} actions={actions}>
        <DetailFormContext value={formId}>{children}</DetailFormContext>
      </NarrowSheet>
    );
  return (
    <section
      ref={sectionRef}
      aria-label={label}
      className={cn(
        // 留めたツールバーの下に、フォーカスを移した入力が隠れないようにする（WCAG 2.2 SC 2.4.11）
        'group/detail min-w-0 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-var(--pane-top,1rem)-1rem)] lg:scroll-pt-20 lg:overflow-y-auto lg:rounded-3xl lg:bg-background lg:p-0 lg:shadow-none lg:backdrop-filter-none',
        // 狭い画面でこの形が出るのは、URL を直接開いたときだけ。全体の高さで一覧を覆う。広い画面では
        // fixed を外して sticky に戻し、ページをスクロールしてもペインの上端のツールバーを見せる
        open
          ? 'fixed inset-x-0 bottom-0 z-30 flex h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-t-3xl bg-background lg:sticky lg:inset-x-auto lg:bottom-auto lg:h-auto lg:flex-none lg:overflow-y-auto lg:border-0'
          : 'hidden',
      )}
    >
      {open && (
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center px-4 pt-2 pb-1 lg:hidden',
            // 主な操作のボタンが、下の見出しに重ならない高さを取る。ボタンは詳細のフォームが
            // あるときだけ出る（DetailSubmit）ので、高さも同じ条件で取る
            actions && SUBMIT_ROW_HEIGHT,
          )}
        >
          <span aria-hidden className="h-6 w-16" />
          <Link
            href={closeHref}
            scroll={false}
            onClick={() => {
              openerRef.current = selectedRow();
              // 戻す先の行にフォーカスを移せるよう、移る前に一覧の inert を外す
              setCovered(false);
            }}
            className={cn(
              'absolute top-2 rounded-full px-3 py-1 text-small text-muted-foreground hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring',
              actions ? CLOSE_BESIDE_SUBMIT : 'right-3',
            )}
          >
            閉じる
          </Link>
          {actions && <div className="absolute top-1.5 right-3 flex">{actions}</div>}
        </div>
      )}
      {/* 広い画面のペインの上の行。詳細の列を隠すボタンと、末尾に主な操作を置く。ガラスのバーに
          しない。一覧の列を隠すボタンは、一覧のツールバーが持つ */}
      <div className="sticky top-0 z-10 hidden items-center justify-end gap-2 bg-background px-4 pt-3 pb-2 lg:flex">
        <PaneToggle pane="detail" className="flex" />
        {actions}
      </div>
      {/* 一覧を隠して幅が広がっても、入力の行を読める長さに留める */}
      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-4 pb-6 lg:overflow-visible lg:px-6 lg:pt-2 lg:pb-6">
        <DetailFormContext value={formId}>{children}</DetailFormContext>
      </div>
    </section>
  );
};

/** 狭い画面のシート。開閉は URL の選んだ 1 件に従い、閉じたら選んだ 1 件を外した一覧へ移る */
const NarrowSheet = ({
  open,
  closeHref,
  label,
  actions,
  children,
}: {
  open: boolean;
  closeHref: string;
  label: string;
  actions?: ReactNode;
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
              'group/detail pointer-events-auto flex h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-3xl outline-none',
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
            <div
              className={cn(
                'relative flex shrink-0 items-center justify-center px-4 pt-2 pb-1',
                actions && SUBMIT_ROW_HEIGHT,
              )}
            >
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
              {/* 主な操作が出るときは、閉じるを先頭に、主な操作を末尾に置く */}
              <Drawer.Close
                className={cn(
                  'absolute top-2 rounded-full px-3 py-1 text-small text-muted-foreground hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring',
                  actions ? CLOSE_BESIDE_SUBMIT : 'right-3',
                )}
              >
                閉じる
              </Drawer.Close>
              {actions && <div className="absolute top-1.5 right-3 flex">{actions}</div>}
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
