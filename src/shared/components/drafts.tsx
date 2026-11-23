'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';

/**
 * 保存していない直しかけ（#366 の「直しかけの扱い」）。管理画面の中で別の 1 件を選んでも残し、
 * 一覧の行とシングルで分かるようにする。再読み込みと、管理画面の外へ移るときだけ確かめる。
 * 自動保存はしない（#366 の「自動保存を見送る」）
 */

type Draft = Record<string, string>;

/**
 * 直しかけと、比べる元の値（直しかけを重ねる前に開いたときのフォームの値）と、直しかけを
 * 始めたときに保存されていた値
 */
type Entry = {
  values: Draft;
  baseline: Draft;
  opened: Record<string, string>;
  /** 保存しようとしたら、別の画面で先に保存されていた */
  rejected?: boolean;
};

type DraftStore = {
  drafts: ReadonlyMap<string, Entry>;
  save: (key: string, entry: Entry) => void;
  clear: (key: string) => void;
};

const DraftContext = createContext<DraftStore | null>(null);

const LEAVE_MESSAGE = '保存していない直しかけがあります。移ると失われます。移りますか？';

export const DraftProvider = ({ children }: { children: ReactNode }) => {
  const [drafts, setDrafts] = useState<ReadonlyMap<string, Entry>>(new Map());
  const save = useCallback((key: string, entry: Entry) => {
    setDrafts((current) => new Map(current).set(key, entry));
  }, []);
  const clear = useCallback((key: string) => {
    setDrafts((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  }, []);

  const hasDrafts = drafts.size > 0;
  useEffect(() => {
    if (!hasDrafts) return;
    // 再読み込みと、タブを閉じるとき。文言はブラウザが決める
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    // 管理画面の外へのリンク。管理画面の中なら直しかけは残るので確かめない
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin === location.origin && url.pathname.startsWith('/dash')) return;
      if (!confirm(LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [hasDrafts]);

  const value = useMemo(() => ({ drafts, save, clear }), [drafts, save, clear]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
};

/** フォームの値を、同じ名前の値は `,` でつないで 1 つの文字列にする */
const serialize = (form: HTMLFormElement): Draft => {
  const draft: Draft = {};
  for (const [name, value] of new FormData(form)) {
    if (typeof value !== 'string') continue;
    draft[name] = name in draft ? `${draft[name]},${value}` : value;
  }
  return draft;
};

/**
 * 1 つのフォームの直しかけ。`initialValues` に直しかけを重ねた値を返す。フォームに `bind` を
 * 渡すと、入力のたびに直しかけを残す。送信で印を消し、保存に失敗した結果（`result`）が返ったら
 * 直しかけを戻す。直しかけと初めの値が同じなら残さない。
 *
 * 直しかけを始めた後に、別の画面で同じ 1 件が保存されていたら、違う項目を `conflict` で返す。
 * 黙って上書きも削除もせず、続けるか捨てるかを選んでもらう（HIG File management の「Help people
 * be confident that their work is always preserved unless they cancel or delete it」）
 */
export const useDraft = <V extends Record<string, string>>(
  key: string,
  initialValues: V,
  /** Server Action の結果。保存に成功すると別の画面へ移るため、返った結果はすべて失敗 */
  result: { status: string } | null,
  /** 項目の名前。違う項目を知らせるのに使う */
  labels: Partial<Record<keyof V, string>>,
) => {
  const store = useContext(DraftContext);
  const router = useRouter();
  const entry = store?.drafts.get(key);
  // 比べる元の値。直しかけを重ねて開いたときは、その直しかけの元の値を使う
  const mounted = useRef<Draft | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  // 送信した後は、残っている読み取りで直しかけを作り直さない
  const submitting = useRef(false);
  const opened = useRef(entry);
  // 送信で消した直しかけ。保存に失敗したら戻す
  const sent = useRef<Entry | null>(null);
  // 直しかけを捨てたら、フォームを保存された値で描き直す
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    // 部品（Switch など）が隠れた値を入れた後に、元の値を読む
    const timer = setTimeout(() => {
      if (opened.current) mounted.current = opened.current.baseline;
      else if (formRef.current) mounted.current = serialize(formRef.current);
    }, 0);
    return () => clearTimeout(timer);
  }, [formKey]);

  useEffect(() => {
    if (!result || !store) return;
    submitting.current = false;
    const conflicted = result.status === 'conflict';
    if (sent.current) store.save(key, { ...sent.current, rejected: conflicted });
    sent.current = null;
    // 開いた後に別の画面で保存されていた。保存された値を読み直し、違う項目を知らせる
    if (conflicted) router.refresh();
    // 送信のときだけ動かす。store と key と router は開いている間は変わらない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const values = useMemo(
    () => (entry ? ({ ...initialValues, ...entry.values } as V) : initialValues),
    // 開いたときの値だけを使う。入力のたびに描き直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialValues, formKey],
  );

  // 直しかけを始めたときの値と、いま保存されている値が違う項目
  const changedLabels = entry
    ? (Object.keys(initialValues) as (keyof V & string)[])
        .filter((name) => (entry.opened[name] ?? '') !== initialValues[name])
        .map((name) => labels[name] ?? name)
    : [];

  const capture = (form: HTMLFormElement) => {
    if (!store) return;
    // 部品（Switch など）が値を書き換えた後に読む
    setTimeout(() => {
      if (submitting.current) return;
      const read = serialize(form);
      const kept = store.drafts.get(key);
      const baseline = kept?.baseline ?? mounted.current ?? read;
      // 値が無いと何も送らない入力（全部外したトークンの欄）は、FormData に名前が出ない。元の値に
      // あった名前は空の値で残す。残さないと、開き直したときに保存された値が重なって戻る
      const current: Draft = {
        ...Object.fromEntries(Object.keys(baseline).map((name) => [name, ''])),
        ...read,
      };
      const changed = Object.keys({ ...baseline, ...current }).some(
        (name) => (baseline[name] ?? '') !== (current[name] ?? ''),
      );
      if (changed)
        store.save(key, { values: current, baseline, opened: kept?.opened ?? initialValues });
      else store.clear(key);
    }, 0);
  };

  const bind = {
    ref: (form: HTMLFormElement | null) => {
      formRef.current = form;
    },
    // 入力し直したら（保存に失敗した後など）、また直しかけを残す
    onInput: (event: FormEvent<HTMLFormElement>) => {
      submitting.current = false;
      capture(event.currentTarget);
    },
    onChange: (event: FormEvent<HTMLFormElement>) => {
      submitting.current = false;
      capture(event.currentTarget);
    },
    onClick: (event: FormEvent<HTMLFormElement>) => capture(event.currentTarget),
    onSubmit: () => {
      submitting.current = true;
      sent.current = store?.drafts.get(key) ?? null;
      store?.clear(key);
    },
  };

  const conflict =
    entry && (changedLabels.length > 0 || entry.rejected)
      ? {
          /** 違う項目。空なら、別の画面の保存はこのフォームの項目を変えていない */
          labels: changedLabels,
          /** 直しかけを続ける。保存すると、違う項目は直しかけの値になる */
          keep: () => store?.save(key, { ...entry, opened: initialValues, rejected: false }),
          /** 直しかけを捨て、保存された値で開き直す */
          discard: () => {
            opened.current = undefined;
            mounted.current = null;
            store?.clear(key);
            setFormKey((n) => n + 1);
          },
        }
      : null;

  return { values, hasDraft: entry !== undefined, bind, formKey, conflict };
};

/**
 * 直しかけを始めた後に、別の画面で同じ 1 件が保存されていたことの知らせ。違う項目を挙げ、
 * 続けるか捨てるかを選んでもらう。フォームの先頭に置く
 */
export const DraftConflict = ({
  conflict,
  noun,
}: {
  conflict: ReturnType<typeof useDraft>['conflict'];
  /** 「この実績」の「実績」 */
  noun: string;
}) => {
  const ref = useRef<HTMLDivElement & HTMLParagraphElement>(null);
  const shown = conflict ? conflict.labels.join('・') || 'rejected' : null;
  // 出たときに知らせへフォーカスを移す。詳細の列をスクロールした後でも、知らせが画面に入る
  useEffect(() => {
    if (shown) ref.current?.focus();
  }, [shown]);
  if (!conflict) return null;
  if (conflict.labels.length === 0)
    return (
      <p ref={ref} tabIndex={-1} role="alert" className="rounded-2xl bg-tint/10 p-4 text-small">
        保存する前に、別の画面でこの{noun}
        を含む内容が保存されていたため、保存していません。この画面の項目に違いはありません。もう一度保存してください
      </p>
    );
  // フォームの中に置くため、押してもフォームの入力の読み取り（`bind` の onClick）に渡さない
  const run = (action: () => void) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    action();
  };
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="flex flex-col gap-3 rounded-2xl bg-tint/10 p-4 text-small"
    >
      <p>
        直しかけを始めた後に、別の画面でこの{noun}が保存されました。違う項目:{' '}
        {conflict.labels.join('・')}
      </p>
      <p className="text-muted-foreground">
        続けて保存すると、これらの項目は直しかけの値になります。捨てると、別の画面で保存された内容で開き直します。
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={run(conflict.keep)}
          className="rounded-full bg-tint px-4 py-1.5 font-medium text-tint-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          直しかけを続ける
        </button>
        <button
          type="button"
          onClick={run(conflict.discard)}
          className="rounded-full px-4 py-1.5 font-medium ring-1 ring-border hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          直しかけを捨てる
        </button>
      </div>
    </div>
  );
};

/** 直しかけの鍵の一覧。鍵は `<オブジェクト>:<uid>`。Sidebar が、どのまとまりに直しかけがあるかを示すのに使う */
export const useDraftKeys = (): string[] => [...(useContext(DraftContext)?.drafts.keys() ?? [])];

/** 直しかけがあることの印。一覧の行とシングルに置く。色だけに頼らず、言葉も添える */
export const DraftMark = ({ draftKey }: { draftKey: string }) => {
  const store = useContext(DraftContext);
  if (!store?.drafts.has(draftKey)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-caption font-medium text-tint">
      <span aria-hidden className="size-1.5 rounded-full bg-tint" />
      直しかけ
    </span>
  );
};
