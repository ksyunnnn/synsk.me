'use client';

import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type MouseEvent } from 'react';
import { SavedNotice } from '@/shared/components/saved-notice';

/**
 * 保存操作をしていない入力を、ブラウザの `localStorage` に持つフォーム（specs/003-note/spec.md の
 * FR-018、specs/003-note/research.md の R10）。D1 には書かない。
 *
 * - 入力のたびに、フォームの値を `storageKey` の名前で持つ
 * - 画面を開くと、持っている値を入力に戻す。隠れた入力（uid と楽観ロックの値）は戻さない
 * - 送信しても消さない。保存に成功した Server Action は `?saved=1` を付けた画面へ移し、その画面の
 *   `DraftSavedNotice` が、送った書きかけを消す。Server Action が失敗の結果を返したら、送った値を
 *   持ち直す。結果を返さずに投げた（通信の切断、D1 の失敗）ときは、書きかけが残る
 * - 画面を開いたとき、JavaScript が動く前にオーナーが入力を変えていたら、書きかけを戻さない。
 *   動く前に打った値は、動き始めた後もそのまま残し、その時点で書きかけに書く（下の
 *   `typedBeforeHydration`）
 * - `version` は、編集の画面が開いたときの行の更新日時で、持つ名前に含める。別の画面で先に
 *   保存された後に開き直すと名前が変わり、前の更新日時の書きかけは消さずに残し、自動では戻さない。
 *   戻すと、触っていない項目まで古い値で先の保存を上書きする（specs/003-note/spec.md の FR-020）
 * - 前の版の書きかけ（同じ `storageKey` で、`version` が違う名前の書きかけ）があれば、フォームの
 *   上に、モーダルでない知らせを出す。オーナーは「書きかけを戻す」で入力に戻すか、「書きかけを
 *   捨てる」で消す。どちらも、その画面で次に入力するまでは「取り消す」で前の状態に戻せるので、
 *   確認を求めない（下の `StaleDraftNotice`）。書きかけは書いた日時を持ち、新しいものから
 *   1 件ずつ知らせる。日時を持たない形式で書いた書きかけは、日時を持つものの後に、名前の順で回す
 * - 書きかけは、書いた画面が開いたときの値（`base`）も持つ。「書きかけを戻す」は、`base` と違う
 *   項目（書きかけで変えた項目）だけを戻し、ほかの項目は開いた版の値のまま残す。触っていない項目を
 *   古い値に戻すと、保存したときに先の保存を上書きするため（FR-020、下の `mergeStale`）。`base` を
 *   持たない形式で書いた書きかけは、変えた項目が分からないので、すべての項目を戻す
 *
 * 使い手は 003 の note の入力。保存していない入力を端末に残すのは note だけの要件で、ほかの
 * 管理画面の入力は使わない（specs/003-note/spec.md の Clarifications の Session 2026-11-11）。
 * JavaScript なしでは何もせず、ふつうのフォームとして送る。JavaScript が動く前に打った入力は、
 * 動き始めた時点で書きかけ（localStorage）に書く。動く前に送られ、応答を待つ間に動き始めた
 * かもしれないので、送った書きかけの印も付け、移った先の `DraftSavedNotice` が消す。印は
 * 送信を見ずに付けるので、保存の成功と読むのは付けてから 60 秒の内に、送った応答で開いた
 * 画面だけにする（下の `SENT_BEFORE_HYDRATION_TTL_MS`）
 */

type DraftValues = Record<string, string[]>;

type Props = Omit<ComponentPropsWithoutRef<'form'>, 'action'> & {
  action: (formData: FormData) => void;
  /** 書きかけを持つ名前。画面ごと・行ごとに違う値にする（例: `note:new`、`note:<uid>`） */
  storageKey: string;
  /** 開いたときの行の更新日時。登録の画面と、楽観ロックを持たない入力は渡さない */
  version?: string;
  /** Server Action の結果。`saved` 以外が来たら、送った値を持ち直す */
  result: { status: string } | null;
};

const STORAGE_PREFIX = 'synsk:draft:';

/** 送信して、保存の成功をまだ確かめていない書きかけの名前を持つ場所 */
const SENT_KEY = 'synsk:draft-sent';

/**
 * `SENT_KEY` の印を、送信を見ずに、動き始めた時点で付けたことを示す場所。値は付けた時刻
 * （ミリ秒）。動く前に送られたかは分からない（下の `typedBeforeHydration`）
 */
const SENT_BEFORE_HYDRATION_KEY = 'synsk:draft-sent-before-hydration';

/**
 * 動き始めた時点で付けた印を、保存の成功と読んでよい時間。動く前の送信の応答は、この時間の
 * 内に返る。過ぎた印は送っていない書きかけのものとして扱い、消さない（FR-018、
 * docs/SOFTWARE_DESIGN.md の原則 2。推測に頼る範囲に上限を置く）
 */
const SENT_BEFORE_HYDRATION_TTL_MS = 60_000;

/**
 * この文書を、再読み込みか「戻る」「進む」で開いたか。動く前の送信の応答なら、ふつうの移動
 * （`navigate`）で開く（https://developer.mozilla.org/en-US/docs/Web/API/PerformanceNavigationTiming/type）
 */
const isReopened = () => {
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  return entry !== undefined && entry.type !== 'navigate';
};

/** 書きかけを持つ名前。編集の画面は開いたときの更新日時を含める */
const toStorageKey = (storageKey: string, version: string | undefined) =>
  `${STORAGE_PREFIX}${storageKey}${version === undefined ? '' : `@${version}`}`;

/**
 * 持っている書きかけ。`writtenAt` は書いた日時（端末の時計の ISO 8601 の文字列）。`base` は、
 * 書きかけを書いた画面が開いたときの入力の値（その版の値）。前の版の書きかけを戻すとき、`base` と
 * 違う項目だけを戻す。日時を持たない形式（値だけを持つ）で書いた書きかけは、どちらも持たない。
 * `base` を持たない形式で書いた書きかけも読む
 */
type StoredDraft = { values: DraftValues; writtenAt?: string; base?: DraftValues };

const isDraftValues = (values: unknown): values is DraftValues =>
  typeof values === 'object' &&
  values !== null &&
  !Array.isArray(values) &&
  Object.values(values).every(
    (list) => Array.isArray(list) && list.every((v) => typeof v === 'string'),
  );

/**
 * 持っている書きかけを読む。日時を持つ形式（`{ writtenAt, values }`）と、日時を持たない形式
 * （値だけ）の両方を読む。形が違えば null
 */
const parseDraft = (stored: string | null): StoredDraft | null => {
  if (stored === null) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { writtenAt, values, base } = parsed as {
      writtenAt?: unknown;
      values?: unknown;
      base?: unknown;
    };
    // 日時を持たない形式では、項目の値が配列なので、`writtenAt` が文字列にならない
    if (typeof writtenAt === 'string' && isDraftValues(values))
      return isDraftValues(base) ? { values, writtenAt, base } : { values, writtenAt };
    return isDraftValues(parsed) ? { values: parsed } : null;
  } catch {
    return null;
  }
};

/** 前の版の書きかけ。`stored` は持っている文字列のまま。取り消しで書き戻す */
type StaleDraft = { key: string; stored: string; values: DraftValues; base?: DraftValues };

/**
 * 同じ `storageKey` の、`version` が違う書きかけ。書いた日時の新しいものから並べ、日時を持たない
 * ものは後に名前の順で並べる。
 *
 * 保存の知らせの画面（`?saved=1`）では、送って保存の成功を待っている書きかけ（`SENT_KEY`）を
 * 挙げない。編集の画面で保存すると、新しい版で開き直したその画面で、送った前の版の書きかけを
 * `DraftSavedNotice` が消す。どちらの部品が先に動くかは、画面の中で置いた順で変わる。消される前の
 * 書きかけを知らせないようにする。ほかの画面では挙げる。送信が応答を返さずに失敗した後に、別の
 * 画面で先に保存されると、送った書きかけは前の版の書きかけになり、保存されていないため
 */
const findStaleDrafts = (storageKey: string, currentKey: string): StaleDraft[] => {
  const prefix = `${toStorageKey(storageKey, undefined)}@`;
  const sent = new URLSearchParams(window.location.search).has('saved') ? read(SENT_KEY) : null;
  const found: (StaleDraft & { writtenAt?: string })[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key === null || key === currentKey || key === sent || !key.startsWith(prefix)) continue;
      const stored = read(key);
      const draft = parseDraft(stored);
      if (stored === null || draft === null) continue;
      // 書いた画面が開いたときの値から何も変えていない書きかけは、戻しても何も変わらない
      if (draft.base !== undefined && changedNames(draft.values, draft.base).length === 0) continue;
      found.push({ key, stored, ...draft });
    }
  } catch {
    return [];
  }
  return found
    .sort((a, b) => {
      if (a.writtenAt !== undefined && b.writtenAt !== undefined)
        return a.writtenAt < b.writtenAt ? 1 : a.writtenAt > b.writtenAt ? -1 : 0;
      if (a.writtenAt !== undefined) return -1;
      if (b.writtenAt !== undefined) return 1;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    })
    .map(({ key, stored, values, base }) => ({ key, stored, values, base }));
};

/**
 * フォームの値のうち、オーナーが入力したもの。隠れた入力（uid・楽観ロックの値と、React が
 * Server Action を送るために足す `$ACTION_` の値）は持たない
 */
const toValues = (form: HTMLFormElement): DraftValues => {
  const hidden = new Set(
    Array.from(form.querySelectorAll<HTMLInputElement>('input[type="hidden"]'), (el) => el.name),
  );
  const values: DraftValues = {};
  for (const [name, value] of new FormData(form)) {
    if (typeof value !== 'string' || hidden.has(name) || name.startsWith('$ACTION')) continue;
    (values[name] ??= []).push(value);
  }
  return values;
};

/**
 * 画面が開いたときの入力の値（`defaultValue`・`defaultChecked`・`defaultSelected`）。フォームの
 * 写しを初めの値に戻し（`reset`）、`toValues` で読む。送る値の決まり（無効にした入力、隠れた入力、
 * 改行）を `toValues` と揃えるため。動き始めた時点で 1 回だけ読む。失敗の結果を受けたフォームは
 * 送った値を初めの値に描き直すので、その後に読むと書きかけで変えた項目が見えなくなる
 */
const toDefaultValues = (form: HTMLFormElement): DraftValues => {
  const copy = form.cloneNode(true) as HTMLFormElement;
  copy.reset();
  return toValues(copy);
};

/** 同じ名前の値の並びが同じか */
const sameValues = (a: string[] | undefined, b: string[] | undefined) =>
  (a ?? []).length === (b ?? []).length && (a ?? []).every((value, i) => value === b?.[i]);

/** 書きかけが、書いた画面が開いたときの値（`base`）から変えた項目の名前 */
const changedNames = (values: DraftValues, base: DraftValues) =>
  [...new Set([...Object.keys(values), ...Object.keys(base)])].filter(
    (name) => !sameValues(values[name], base[name]),
  );

/** チェックボックスとマルチセレクトの名前。同じ名前で、値をいくつでも選べる */
const toMultipleNames = (form: HTMLFormElement) =>
  new Set(
    Array.from(form.elements).flatMap((element) =>
      (element instanceof HTMLInputElement && element.type === 'checkbox') ||
      (element instanceof HTMLSelectElement && element.multiple)
        ? [element.name]
        : [],
    ),
  );

/**
 * 前の版の書きかけを戻した後の値。書きかけが `base` を持てば、`base` と違う項目（オーナーが
 * 書きかけで変えた項目）だけを書きかけの値にし、ほかの項目は今の入力のまま残す。いくつでも選べる
 * 項目（`multiple`）は、書きかけで足した値と外した値だけを今の入力に当てる。先に保存した画面が
 * 同じ項目で足した値を外さないため。`base` を持たない書きかけは、変えた項目が分からないので、
 * すべての項目を書きかけの値にする
 */
const mergeStale = (
  current: DraftValues,
  stale: StaleDraft,
  multiple: ReadonlySet<string>,
): DraftValues => {
  const { base } = stale;
  if (base === undefined) return stale.values;
  const merged: DraftValues = { ...current };
  for (const name of changedNames(stale.values, base)) {
    let value: string[] | undefined = stale.values[name];
    if (multiple.has(name)) {
      const before = base[name] ?? [];
      const after = value ?? [];
      const kept = (current[name] ?? []).filter((v) => after.includes(v) || !before.includes(v));
      const added = after.filter((v) => !before.includes(v) && !kept.includes(v));
      value = [...kept, ...added];
      if (value.length === 0) value = undefined;
    }
    if (value === undefined) delete merged[name];
    else merged[name] = value;
  }
  return merged;
};

/**
 * 持っている値を入力に戻す。隠れた入力は触らない。チェックボックスとマルチセレクト以外は、
 * 持っていない名前の入力を触らない
 */
const applyValues = (form: HTMLFormElement, values: DraftValues) => {
  /** 名前ごとの、値を当てた文字の入力の数 */
  const applied = new Map<string, number>();
  for (const element of Array.from(form.elements)) {
    if (!(
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ))
      continue;
    const { name } = element;
    if (name === '' || element.type === 'hidden' || element.type === 'file') continue;
    // 書きかけはフォーム全体を写す。外したチェックボックスと何も選ばないマルチセレクトは
    // FormData に名前が残らないため、名前が無いことを「選ばない」と読む
    const saved = values[name];
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      element.checked = saved?.includes(element.value) ?? false;
      continue;
    }
    if (element instanceof HTMLSelectElement && element.multiple) {
      for (const option of Array.from(element.options))
        option.selected = saved?.includes(option.value) ?? false;
      continue;
    }
    if (saved === undefined) continue;
    if (element instanceof HTMLInputElement && element.type === 'radio') {
      element.checked = saved.includes(element.value);
      continue;
    }
    // 同じ名前の入力が複数あれば、並びの順に値を当てる
    const index = applied.get(name) ?? 0;
    element.value = saved[index] ?? '';
    applied.set(name, index + 1);
  }
};

/** JavaScript が動く前に、オーナーが入力を変えたか。隠れた入力は見ない */
const isTouched = (form: HTMLFormElement): boolean =>
  Array.from(form.elements).some((element) => {
    if (element instanceof HTMLInputElement) {
      if (element.type === 'hidden' || element.type === 'file') return false;
      return element.type === 'checkbox' || element.type === 'radio'
        ? element.checked !== element.defaultChecked
        : element.value !== element.defaultValue;
    }
    if (element instanceof HTMLTextAreaElement) return element.value !== element.defaultValue;
    if (element instanceof HTMLSelectElement)
      return Array.from(element.options).some(
        (option) => option.selected !== option.defaultSelected,
      );
    return false;
  });

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * 文字列はそのまま書く。書きかけは、値を、書いた日時と、画面が開いたときの値（`base`）と一緒に
 * 書く（`StoredDraft`）
 */
const write = (key: string, value: string | { values: DraftValues; base: DraftValues }) => {
  try {
    window.localStorage.setItem(
      key,
      typeof value === 'string'
        ? value
        : JSON.stringify({
            writtenAt: new Date().toISOString(),
            values: value.values,
            base: value.base,
          }),
    );
  } catch {
    // 保存先が使えない（容量の超過、使わせない設定）ときは持たない。入力と送信は続けられる
  }
};

const remove = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 使えない保存先には、消すものも無い
  }
};

/** 書きかけを持つフォームに付ける属性。値は書きかけの名前 */
const DRAFT_KEY_ATTRIBUTE = 'data-draft-key';

/**
 * JavaScript が動く前（hydration の前）にオーナーが打った値。書きかけの名前ごとに持つ。
 *
 * react-dom 19.3.1 の hydration は、初めの値を持つ `<textarea>` の値を初めの値に戻す
 * （`react-dom-client` の `initTextarea` が `element.value = textContent` を入れる）。そのままでは、
 * 動く前に打った本文が消え、保存は初めの本文を送る（FR-018）。このモジュールは、フォームを
 * hydration する前に読み込まれる。読み込んだ時点の値と、それから hydration までの入力を持ち、
 * フォームが動き始めたら戻し、書きかけに書く（FR-018）。動き始める前にふつうのフォームとして
 * 送られ、その応答を待つ間に動き始めることがあるので、送った書きかけの印も付ける
 */
const typedBeforeHydration = new Map<string, DraftValues>();
/** 動き始めたフォームの書きかけの名前。これより後の入力は、フォームが自分で持つ */
const hydratedKeys = new Set<string>();

const captureTyped = (form: HTMLFormElement) => {
  const key = form.getAttribute(DRAFT_KEY_ATTRIBUTE);
  if (key === null || hydratedKeys.has(key)) return;
  // 打った後に初めの値へ戻したら、持った値を捨てる。捨てないと、戻した入力が動き始めた後に戻る
  if (isTouched(form)) typedBeforeHydration.set(key, toValues(form));
  else typedBeforeHydration.delete(key);
};

if (typeof document !== 'undefined') {
  for (const form of Array.from(
    document.querySelectorAll<HTMLFormElement>(`form[${DRAFT_KEY_ATTRIBUTE}]`),
  ))
    captureTyped(form);
  const onInput = (event: Event) => {
    const form =
      event.target instanceof Element
        ? event.target.closest<HTMLFormElement>(`form[${DRAFT_KEY_ATTRIBUTE}]`)
        : null;
    if (form) captureTyped(form);
  };
  document.addEventListener('input', onInput, true);
  document.addEventListener('change', onInput, true);
}

export const DraftRetainingForm = ({
  action,
  storageKey,
  version,
  result,
  children,
  ...props
}: Props) => {
  const formRef = useRef<HTMLFormElement>(null);
  /** 送信した値。失敗の結果が来たら持ち直す */
  const submittedRef = useRef<DraftValues | null>(null);
  /** この版の画面が開いたときの入力の値。動き始めた時点で読む（`toDefaultValues`） */
  const baseRef = useRef<DraftValues>({});
  const key = toStorageKey(storageKey, version);
  /** 知らせている前の版の書きかけ。`undefined` は、まだ探していないこと */
  const [stale, setStale] = useState<StaleDraft | null | undefined>(undefined);
  /** 知らせている書きかけに行った操作。取り消すときに使う */
  const [outcome, setOutcome] = useState<StaleOutcome | null>(null);
  /** 操作の後に入力したら、取り消しを出すのをやめる。入力の処理から読む */
  const outcomeRef = useRef<StaleOutcome | null>(null);
  const settle = (next: StaleOutcome | null) => {
    outcomeRef.current = next;
    setOutcome(next);
  };

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    baseRef.current = toDefaultValues(form);
    // 版を持つ画面だけが、前の版の書きかけを持ちうる
    setStale(version === undefined ? null : (findStaleDrafts(storageKey, key)[0] ?? null));
    outcomeRef.current = null;
    setOutcome(null);
    // 開き直したので、前の送信の成功を待つのをやめる。残った書きかけは、この画面で戻す
    if (read(SENT_KEY) === key) {
      remove(SENT_KEY);
      remove(SENT_BEFORE_HYDRATION_KEY);
    }
    const draft = parseDraft(read(key))?.values;
    const save = () => {
      write(key, { values: toValues(form), base: baseRef.current });
      // 戻す・捨てるの後に入力したら、その操作を確かめたものとし、知らせを閉じる。取り消すと、
      // 操作の後に打った入力まで消えるため
      if (outcomeRef.current) {
        outcomeRef.current = null;
        setOutcome(null);
        setStale(null);
      }
    };
    hydratedKeys.add(key);
    const typed = typedBeforeHydration.get(key);
    typedBeforeHydration.delete(key);
    // 動く前に打った値を戻し、書きかけにも書く。hydration が `<textarea>` を初めの値に戻した
    // 後なので、`isTouched` だけでは打ったことが分からない
    if (typed) {
      applyValues(form, typed);
      save();
      // 動き始める前にふつうのフォームとして送られ、保存に成功したかもしれない。送った書きかけと
      // 同じく扱い、移った先の `DraftSavedNotice` が消す。送られていなければ、開き直した
      // ときに上の行が印を外し、書きかけを戻す
      write(SENT_KEY, key);
      write(SENT_BEFORE_HYDRATION_KEY, String(Date.now()));
    } else if (draft && !isTouched(form)) applyValues(form, draft);

    const send = () => {
      submittedRef.current = toValues(form);
      write(SENT_KEY, key);
      remove(SENT_BEFORE_HYDRATION_KEY);
    };
    form.addEventListener('input', save);
    form.addEventListener('change', save);
    form.addEventListener('submit', send);
    return () => {
      form.removeEventListener('input', save);
      form.removeEventListener('change', save);
      form.removeEventListener('submit', send);
    };
  }, [key, storageKey, version]);

  useEffect(() => {
    const submitted = submittedRef.current;
    if (!result || !submitted) return;
    submittedRef.current = null;
    if (result.status === 'saved') return;
    if (read(SENT_KEY) === key) remove(SENT_KEY);
    remove(SENT_BEFORE_HYDRATION_KEY);
    write(key, { values: submitted, base: baseRef.current });
  }, [result, key]);

  /**
   * 前の版の書きかけを入力に戻し、この版の書きかけにする。書きかけで変えた項目だけを戻し、
   * ほかの項目は開いた版の値のまま残す（`mergeStale`）
   */
  const restore = () => {
    const form = formRef.current;
    if (!form || !stale) return;
    const previous = { stored: read(key), values: toValues(form) };
    applyValues(form, mergeStale(previous.values, stale, toMultipleNames(form)));
    write(key, { values: toValues(form), base: baseRef.current });
    remove(stale.key);
    settle({ kind: stale.base === undefined ? 'restored' : 'restoredChanges', previous });
  };

  /** 前の版の書きかけを消す */
  const discard = () => {
    if (!stale) return;
    remove(stale.key);
    settle({ kind: 'discarded' });
  };

  /** 戻す・捨てるの前の入力と書きかけに戻す */
  const undo = () => {
    const form = formRef.current;
    if (!form || !stale || !outcome) return;
    if (outcome.kind !== 'discarded') {
      applyValues(form, outcome.previous.values);
      if (outcome.previous.stored === null) remove(key);
      else write(key, outcome.previous.stored);
    }
    write(stale.key, stale.stored);
    settle(null);
  };

  return (
    <form
      ref={formRef}
      action={action}
      {...props}
      {...{ [DRAFT_KEY_ATTRIBUTE]: key }}
      // 前の版の書きかけを探し終えた印。知らせが出ないことを確かめるテストが待つ
      {...(stale !== undefined && { 'data-draft-stale-checked': '' })}
    >
      {stale && (
        <StaleDraftNotice
          outcome={outcome?.kind ?? null}
          onRestore={restore}
          onDiscard={discard}
          onUndo={undo}
        />
      )}
      {children}
    </form>
  );
};

/**
 * 前の版の書きかけに行った操作。戻したときは、戻す前の入力と、この版の書きかけを持つ。
 * `restoredChanges` は書きかけで変えた項目だけを戻したこと、`restored` はすべての項目を戻した
 * こと（`base` を持たない書きかけ）
 */
type StaleOutcome =
  | {
      kind: 'restored' | 'restoredChanges';
      previous: { stored: string | null; values: DraftValues };
    }
  | { kind: 'discarded' };

const STALE_BUTTON_CLASS =
  'rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * 前の版の書きかけの知らせ。フォームの上に置き、モーダルにしない。開いた画面に出す知らせは、
 * 作業を止めず、その内容の近くに置く（HIG の Alerts と Feedback）。戻す・捨てるは取り消せるので、
 * 確認を求めず、操作の結果と「取り消す」を出す（HIG の Alerts、Undo and redo）
 */
const StaleDraftNotice = ({
  outcome,
  onRestore,
  onDiscard,
  onUndo,
}: {
  outcome: StaleOutcome['kind'] | null;
  onRestore: () => void;
  onDiscard: () => void;
  onUndo: () => void;
}) => {
  const buttonsRef = useRef<HTMLDivElement>(null);
  /** 押したボタンは入れ替わって消え、焦点を失う。入れ替わった先の最初のボタンへ移すか */
  const refocusRef = useRef(false);
  /** 押したボタンが焦点を持っていたら、入れ替わった先のボタンへ焦点を移す */
  const press = (event: MouseEvent<HTMLButtonElement>, handler: () => void) => {
    refocusRef.current = event.currentTarget === document.activeElement;
    handler();
  };
  useEffect(() => {
    if (!refocusRef.current) return;
    refocusRef.current = false;
    buttonsRef.current?.querySelector('button')?.focus();
  }, [outcome]);
  return (
    <section
      aria-label="前の版の書きかけ"
      className="flex flex-col gap-3 rounded-md border border-border p-4"
    >
      <p aria-live="polite" className="text-sm">
        {outcome === 'restoredChanges'
          ? '書きかけで変えた項目を戻しました。'
          : outcome === 'restored'
            ? '書きかけを戻しました。'
            : outcome === 'discarded'
              ? '書きかけを捨てました。'
              : 'この画面を開く前の版から書いた書きかけが、この端末に残っています。'}
      </p>
      <div ref={buttonsRef} className="flex flex-wrap gap-2">
        {outcome === null ? (
          <>
            <button
              type="button"
              className={STALE_BUTTON_CLASS}
              onClick={(event) => press(event, onRestore)}
            >
              書きかけを戻す
            </button>
            <button
              type="button"
              className={STALE_BUTTON_CLASS}
              onClick={(event) => press(event, onDiscard)}
            >
              書きかけを捨てる
            </button>
          </>
        ) : (
          <button
            type="button"
            className={STALE_BUTTON_CLASS}
            onClick={(event) => press(event, onUndo)}
          >
            取り消す
          </button>
        )}
      </div>
    </section>
  );
};

/**
 * 保存の成功を知らせる。Server Action が保存に成功して移した `?saved=1` の画面に置き、送った
 * 書きかけを消す。
 *
 * 編集の画面で続けて保存すると、同じ `?saved=1` の画面へ移り、この部品は置き直されない。
 * `version` に保存した版の値を渡すか、保存のたびに置き直すと、送った書きかけを消し直す。
 *
 * `storageKeys` には、保存に成功するとこの画面へ移るフォームの `storageKey` を挙げる。送った
 * 書きかけの名前がどれにも合わなければ消さない。ほかの画面の送信が応答を返さずに失敗した後、
 * ブラウザの「戻る」でこの画面へ戻ったときに、その画面の書きかけを消さないため（FR-018）
 */
export const DraftSavedNotice = ({
  storageKeys,
  version,
}: {
  storageKeys: string[];
  version?: string;
}) => {
  const keys = storageKeys.join('\n');
  useEffect(() => {
    const sent = read(SENT_KEY);
    if (sent === null) return;
    // 動き始めた時点で付けた印は、付けてから `SENT_BEFORE_HYDRATION_TTL_MS` の内に、送った応答で
    // 開いたときだけ保存の成功と読む。保存の知らせの画面で動く前に打ち、再読み込みしたとき
    // （印は、その書きかけのフォームが開いたときに外す）と、送らずに離れた後で知らせの画面を
    // 開いたときに、送っていない書きかけを消さないため
    const markedAt = read(SENT_BEFORE_HYDRATION_KEY);
    if (markedAt !== null) {
      // 時刻として読めない値も、過ぎた印として扱う
      if (!(Date.now() - Number(markedAt) <= SENT_BEFORE_HYDRATION_TTL_MS)) {
        remove(SENT_KEY);
        remove(SENT_BEFORE_HYDRATION_KEY);
        return;
      }
      if (isReopened()) return;
    }
    remove(SENT_BEFORE_HYDRATION_KEY);
    // 別の画面の書きかけは消さない。送った印だけを外し、後で同じ種類の `?saved=1` の画面を
    // 開いたときに、保存していない書きかけを消さないようにする。書きかけは、その画面を開き直すと戻る
    if (isSentFrom(sent, keys.split('\n'))) remove(sent);
    remove(SENT_KEY);
  }, [keys, version]);
  // `?saved=1` は書きかけを消す合図を兼ね、戻る・再読み込みで読み直すので、URL から外さない
  return <SavedNotice>保存しました</SavedNotice>;
};

/** 送った書きかけの名前が、挙げた `storageKey` のどれかの書きかけか。名前は更新日時を含みうる */
const isSentFrom = (sent: string, storageKeys: string[]) =>
  storageKeys.some((storageKey) => {
    const name = toStorageKey(storageKey, undefined);
    return sent === name || sent.startsWith(`${name}@`);
  });
