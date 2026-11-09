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
 * - 画面を開いたとき、JavaScript が動く前にオーナーが入力を変えていたら、書きかけを戻さない
 * - `version` は、編集の画面が開いたときの行の更新日時で、持つ名前に含める。別の画面で先に
 *   保存された後に開き直すと名前が変わり、前の更新日時の書きかけは消さずに残し、自動では戻さない。
 *   戻すと、触っていない項目まで古い値で先の保存を上書きする（specs/001-career-and-project/spec.md
 *   の FR-042）。残した書きかけをオーナーにどう見せるかは決まっていない
 *
 * 使い手は 001 の実績・職歴・学歴・組織・スキルの入力。003 の note の入力も使う（R16）。
 * JavaScript なしでは何もせず、ふつうのフォームとして送る。JavaScript が動く前の入力も持たない。
 * 動く前の入力を開いたときに持つと、動く前にふつうのフォームとして送って保存した値が、消されずに
 * 残る
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
    if (read(SENT_KEY) === key) remove(SENT_KEY);
    const draft = parseDraft(read(key));
    const save = () => write(key, toValues(form));
    if (draft && !isTouched(form)) applyValues(form, draft);

    const send = () => {
      submittedRef.current = toValues(form);
      write(SENT_KEY, key);
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
    write(key, submitted);
  }, [result, key]);

  return (
    <form ref={formRef} action={action} {...props}>
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
