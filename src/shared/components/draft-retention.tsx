'use client';

import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';

/**
 * 保存操作をしていない入力を、ブラウザの `localStorage` に持つフォーム（docs/REQUIREMENTS.md の
 * FR-14、specs/001-career-and-project/research.md の R16）。D1 には書かない。
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
 *   戻すと、触っていない項目まで古い値で先の保存を上書きする（specs/001-career-and-project/spec.md
 *   の FR-042）。残した書きかけをオーナーにどう見せるかは決まっていない
 *
 * 使い手は 001 の実績・職歴・学歴・組織・スキルの入力。003 の note の入力も使う（R16）。
 * JavaScript なしでは何もせず、ふつうのフォームとして送る。JavaScript が動く前に打った入力は、
 * 動き始めた時点で書きかけ（localStorage）に書く。動く前に送られ、応答を待つ間に動き始めた
 * かもしれないので、送った書きかけの印も付け、移った先の `DraftSavedNotice` が消す。印は
 * 送信を見ずに付けるので、保存の成功と読むのは付けてから 60 秒の内に、送った応答で開いた
 * 画面だけにする（下の `SENT_BEFORE_HYDRATION_TTL_MS`）
 */

type DraftValues = Record<string, string[]>;

type Props = Omit<ComponentPropsWithoutRef<'form'>, 'action'> & {
  action: (formData: FormData) => void;
  /** 書きかけを持つ名前。画面ごと・行ごとに違う値にする（例: `career:new`、`career:<uid>`） */
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
 * 内に返る。過ぎた印は送っていない書きかけのものとして扱い、消さない（REQUIREMENTS.md の
 * FR-14、docs/SOFTWARE_DESIGN.md の原則 2。推測に頼る範囲に上限を置く）
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

/** 持っている書きかけを読む。形が違えば null */
const parseDraft = (stored: string | null): DraftValues | null => {
  if (stored === null) return null;
  try {
    const values: unknown = JSON.parse(stored);
    if (typeof values !== 'object' || values === null || Array.isArray(values)) return null;
    const entries = Object.values(values);
    return entries.every((list) => Array.isArray(list) && list.every((v) => typeof v === 'string'))
      ? (values as DraftValues)
      : null;
  } catch {
    return null;
  }
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

const write = (key: string, value: DraftValues | string) => {
  try {
    window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
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
 * 動く前に打った本文が消え、保存は初めの本文を送る（FR-14）。このモジュールは、フォームを
 * hydration する前に読み込まれる。読み込んだ時点の値と、それから hydration までの入力を持ち、
 * フォームが動き始めたら戻し、書きかけに書く（FR-14）。動き始める前にふつうのフォームとして
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
  const key = toStorageKey(storageKey, version);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    // 開き直したので、前の送信の成功を待つのをやめる。残った書きかけは、この画面で戻す
    if (read(SENT_KEY) === key) {
      remove(SENT_KEY);
      remove(SENT_BEFORE_HYDRATION_KEY);
    }
    const draft = parseDraft(read(key));
    const save = () => write(key, toValues(form));
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
  }, [key]);

  useEffect(() => {
    const submitted = submittedRef.current;
    if (!result || !submitted) return;
    submittedRef.current = null;
    if (result.status === 'saved') return;
    if (read(SENT_KEY) === key) remove(SENT_KEY);
    remove(SENT_BEFORE_HYDRATION_KEY);
    write(key, submitted);
  }, [result, key]);

  return (
    <form ref={formRef} action={action} {...props} {...{ [DRAFT_KEY_ATTRIBUTE]: key }}>
      {children}
    </form>
  );
};

/**
 * 保存の成功を知らせる。Server Action が保存に成功して移した `?saved=1` の画面に置き、送った
 * 書きかけを消す。
 *
 * 編集の画面で続けて保存すると、同じ `?saved=1` の画面へ移り、この部品は置き直されない。
 * `version` に保存した行の更新日時を渡すと、保存のたびに値が変わり、送った書きかけを消し直す。
 * 一覧の画面へ移す入力（学歴・スキル）は、登録・編集の画面を挟むたびに置き直されるので渡さない。
 *
 * `storageKeys` には、保存に成功するとこの画面へ移るフォームの `storageKey` を挙げる。送った
 * 書きかけの名前がどれにも合わなければ消さない。ほかの画面の送信が応答を返さずに失敗した後、
 * ブラウザの「戻る」でこの画面へ戻ったときに、その画面の書きかけを消さないため（FR-14）
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
  return <p role="status">保存しました</p>;
};

/** 送った書きかけの名前が、挙げた `storageKey` のどれかの書きかけか。名前は更新日時を含みうる */
const isSentFrom = (sent: string, storageKeys: string[]) =>
  storageKeys.some((storageKey) => {
    const name = toStorageKey(storageKey, undefined);
    return sent === name || sent.startsWith(`${name}@`);
  });
