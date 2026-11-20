'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

/**
 * 保存していない直しかけ（#366 の「直しかけの扱い」）。管理画面の中で別の 1 件を選んでも残し、
 * 一覧の行とシングルで分かるようにする。再読み込みと、管理画面の外へ移るときだけ確かめる。
 * 自動保存はしない（#366 の「自動保存を見送る」）
 */

type Draft = Record<string, string>;

/** 直しかけと、比べる元の値（直しかけを重ねる前に開いたときの値） */
type Entry = { values: Draft; baseline: Draft };

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
 * 渡すと、入力のたびに直しかけを残し、送信で消す。直しかけと初めの値が同じなら残さない
 */
export const useDraft = <V extends Record<string, string>>(key: string, initialValues: V) => {
  const store = useContext(DraftContext);
  const entry = store?.drafts.get(key);
  // 直しかけが無いときに開いた値。元の値と比べ、変わっていなければ直しかけにしない
  const mounted = useRef<Draft | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  // 送信した後は、残っている読み取りで直しかけを作り直さない
  const submitting = useRef(false);
  const hadEntry = useRef(entry !== undefined);
  useEffect(() => {
    // 部品（Switch など）が隠れた値を入れた後に、元の値を読む
    const timer = setTimeout(() => {
      if (!hadEntry.current && formRef.current) mounted.current = serialize(formRef.current);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const values = useMemo(
    () => (entry ? ({ ...initialValues, ...entry.values } as V) : initialValues),
    // 開いたときの値だけを使う。入力のたびに描き直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialValues],
  );

  const capture = (form: HTMLFormElement) => {
    if (!store) return;
    // 部品（Switch など）が値を書き換えた後に読む
    setTimeout(() => {
      if (submitting.current) return;
      const current = serialize(form);
      const baseline = store.drafts.get(key)?.baseline ?? mounted.current ?? current;
      const changed = Object.keys({ ...baseline, ...current }).some(
        (name) => (baseline[name] ?? '') !== (current[name] ?? ''),
      );
      if (changed) store.save(key, { values: current, baseline });
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
      store?.clear(key);
    },
  };

  return { values, hasDraft: entry !== undefined, bind };
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
