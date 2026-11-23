'use client';

import { Toggle } from '@base-ui/react/toggle';
import { useSearchParams } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 管理画面の Sidebar と、Split view の一覧の列と詳細の列を、利用者が隠せるようにする。既定は表示
 * する（HIG Sidebars の「Consider letting people hide the sidebar」「Avoid hiding the sidebar by
 * default」、HIG Split views の「Consider letting people hide a pane」）。詳細を隠すのは、時系列の
 * ように横の幅を使う見せ方で一覧の列を広げるため。一覧を隠すのは、詳細の入力に幅を使うため。
 * 隠すのは広い画面だけで、狭い画面の並びは変えない
 */

type Pane = 'sidebar' | 'collection' | 'detail';

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
  /** ドロワーを全体の幅に広げる */
  expand: () => void;
  /** 選んだ 1 件が変わったときに呼ぶ。広げる前の見せ方に戻す */
  settle: (selected: boolean) => void;
}>({
  hidden: { sidebar: false, collection: false, detail: false },
  setHidden: () => {},
  expand: () => {},
  settle: () => {},
});

/** 押した状態が「隠している」にあたる。状態は押した状態（`aria-pressed`）で伝え、名前は変えない */
const LABELS: Record<Pane, string> = {
  sidebar: 'サイドバーを隠す',
  collection: '一覧を隠す',
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
        {pane === 'sidebar' && <line x1="9" y1="4" x2="9" y2="20" />}
        {/* 一覧の列は、左の区画に行の線を足し、Sidebar の印と見分ける */}
        {pane === 'collection' && (
          <>
            <line x1="10" y1="4" x2="10" y2="20" />
            <line x1="5.5" y1="9" x2="7.5" y2="9" />
            <line x1="5.5" y1="12" x2="7.5" y2="12" />
            <line x1="5.5" y1="15" x2="7.5" y2="15" />
          </>
        )}
        {pane === 'detail' && <line x1="15" y1="4" x2="15" y2="20" />}
      </svg>
    </Toggle>
  );
};

/**
 * 広い画面で、詳細の列を隠しているか。隠しているときは、選んだ 1 件を一覧に重なるドロワーで出す
 * （`DetailSheet`）
 */
export const useDetailPeek = () => useContext(PanesContext).hidden.detail;

/**
 * ドロワーを全体の幅に広げるボタン。一覧を隠し、詳細を全体の幅の列で出す（Notion の「Click ⤡ at
 * the top left to view in full page mode.」https://www.notion.com/help/intro-to-databases ）。
 * 一覧に戻すのは、一覧の列を隠すボタン（`PaneToggle`）が持つ。広げたことは履歴に載せず、選んだ 1 件が
 * 変わったら（戻る・進むを含む）、広げる前のドロワーの見せ方に戻す
 */
export const ExpandDetailButton = () => {
  const { expand } = useContext(PanesContext);
  return (
    <button
      type="button"
      onClick={expand}
      aria-label="全体に広げる"
      title="全体に広げる"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
      </svg>
    </button>
  );
};

/** Split view の中か。一覧のツールバーは、一覧だけの画面でも使うため */
const InSplitContext = createContext(false);

/**
 * 一覧の列を隠すボタン。隠すボタンは、隠す列の中に置く（Sidebar と詳細の列と同じ）。Split view の
 * 中でだけ出す。一覧だけの画面では、隠すと何も残らないため
 */
export const CollectionPaneToggle = () => {
  const inSplit = useContext(InSplitContext);
  if (!inSplit) return null;
  return <PaneToggle pane="collection" className="-ml-3 hidden lg:flex" />;
};

/** 管理画面の枠。Sidebar を隠しているときは、一覧の列が全体の幅を使う */
export const DashPanes = ({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) => {
  const [hidden, setState] = useState<Record<Pane, boolean>>({
    sidebar: false,
    collection: false,
    detail: false,
  });
  // ドロワーを全体の幅に広げているか。広げる前は詳細を隠していた
  const [expanded, setExpanded] = useState(false);
  // 一覧と詳細の両方は隠さない。片方を隠したら、もう片方を表示に戻す
  const setHidden = (pane: Pane, value: boolean) => {
    setExpanded(false);
    setState((current) => ({
      ...current,
      [pane]: value,
      ...(value && pane === 'collection' && { detail: false }),
      ...(value && pane === 'detail' && { collection: false }),
    }));
  };
  const expand = () => {
    setState((current) => ({ ...current, collection: true, detail: false }));
    setExpanded(true);
  };
  // 広げていたら、広げる前（詳細を隠して一覧を出す）に戻す。広げていなければ、選んだ 1 件が無く
  // なったときだけ一覧の列を表示に戻す
  const settle = (selected: boolean) => {
    if (expanded) {
      setExpanded(false);
      setState((current) => ({ ...current, collection: false, detail: true }));
    } else if (!selected) setState((current) => ({ ...current, collection: false }));
  };
  const [covered, setCovered] = useState(false);
  const cover = useMemo(() => ({ covered, setCovered }), [covered]);
  return (
    <PanesContext value={{ hidden, setHidden, expand, settle }}>
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
 * Split view の並び。片方の列を隠しているときは、もう片方が全体の幅を使う。詳細の列を隠して
 * いるときに 1 件を選んだら、列には戻さず、一覧に重なるドロワーで出す。一覧の幅を保ったまま、
 * 一覧を操作し続けられるようにする（Notion の Side peek の「The rest of the database view
 * continues to be interactive on the left.」https://www.notion.com/help/views-filters-and-sorts ）。
 * 選んだ 1 件を外したら（Sidebar やパンくずから一覧へ移ったときを含む）、一覧の列を表示に戻す。
 * 隠した列を戻す手段を、ボタンのほかにも持たせる（HIG Split views の「Provide multiple ways to
 * reveal hidden panes」）。
 *
 * 詳細の列は、入力が詰まらない幅を下限にする（HIG Split views の「Set reasonable defaults for
 * minimum and maximum pane sizes」）
 */
export const SplitPanes = ({
  collection,
  detail,
}: {
  collection: ReactNode;
  detail: ReactNode;
}) => {
  const { hidden, settle } = useContext(PanesContext);
  const { covered } = useContext(CoverContext);
  const selected = useSearchParams().get('selected');
  useEffect(() => {
    settle(selected !== null && selected !== '');
    // settle は描画のたびに作り直すので、選んだ 1 件が変わったときだけ動かす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  return (
    <InSplitContext value={true}>
      <main
        className={cn(
          'grid gap-4',
          !hidden.detail &&
            !hidden.collection &&
            'lg:grid-cols-[minmax(0,1fr)_minmax(440px,600px)]',
        )}
      >
        {/* 隠した列を戻すボタンは、隠した列があった側に置く */}
        {hidden.detail && (
          <div className="hidden justify-end lg:flex">
            <PaneToggle pane="detail" className="flex bg-background" />
          </div>
        )}
        {hidden.collection && (
          <div className="hidden lg:flex">
            <PaneToggle pane="collection" className="flex bg-background" />
          </div>
        )}
        <div className={cn('contents', hidden.collection && 'lg:hidden')} inert={covered}>
          {collection}
        </div>
        {/* 詳細を隠しているときの出し方は、詳細のペイン（`DetailSheet`）が決める */}
        {detail}
      </main>
    </InSplitContext>
  );
};
