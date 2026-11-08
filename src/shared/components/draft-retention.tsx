'use client';

import { useEffect, useRef } from 'react';

/**
 * 入力中の内容をブラウザの `localStorage` に持ち、保存せずに再読み込みしても入力を戻す
 * （docs/REQUIREMENTS.md の FR-14、specs/001-career-and-project/research.md の R16）。D1 には書かない。
 *
 * フォームの中に置く。置いたフォームの入力のたびと、画面を離れるとき（再読み込みを含む）に内容を
 * 書き、開いたときに書いた内容があれば入力へ戻す。開いたときの値から変わっていなければ書かずに消す。
 * JavaScript が動き出す前に入力していたら、戻さずにその入力を書く。送るときに消し、保存に失敗して
 * 同じ画面に戻ったら（`result` が変わったら）書き直す。保存に成功した画面は別の画面へ移るため、
 * 消したまま残らない。
 *
 * `version` は編集を始めたときの更新日時（楽観ロックの値）。書いたときと開いたときで違えば、
 * 別の画面で保存された後の古い入力として戻さず捨てる。戻すと、新しい値を古い入力で上書きできて
 * しまうため（設計原則 1）。
 *
 * 戻す値は、送る入力（hidden・file・送信のボタンを除く）だけ。ブラウザの保存領域が使えない
 * とき（プライベートのウィンドウなど）は何もしない。
 *
 * 使い手は 001 の実績・職歴・学歴・組織・スキルの入力と、002 の写した行の入力
 */

type Draft = { version: string; values: Record<string, string[]> };

const PREFIX = 'synsk:draft:';

const SKIPPED_TYPES = new Set(['hidden', 'file', 'submit', 'button', 'reset', 'image']);

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const isControl = (el: unknown): el is Control =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement;

const controlsOf = (form: HTMLFormElement): Control[] =>
  [...form.elements]
    .flatMap((el) => (isControl(el) ? [el] : []))
    .filter(
      (el) => el.name !== '' && !SKIPPED_TYPES.has(el.type) && !('readOnly' in el && el.readOnly),
    );

const isChoice = (el: Control): el is HTMLInputElement =>
  el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio');

/** 入力の値を名前ごとに読む。チェックボックスとラジオボタンは、選んだものの値だけ */
const readForm = (form: HTMLFormElement): Record<string, string[]> => {
  const values: Record<string, string[]> = {};
  for (const el of controlsOf(form)) {
    const list = (values[el.name] ??= []);
    if (isChoice(el)) {
      if (el.checked) list.push(el.value);
    } else {
      list.push(el.value);
    }
  }
  return values;
};

/**
 * 画面を開いたときの値（サーバーが描いた値）を、`readForm` と同じ形で読む。保存に失敗して
 * 描き直すと初めの値が送った値に変わるため、開いたときに 1 度だけ読んで比べる基準にする
 */
const readDefaults = (form: HTMLFormElement): Record<string, string[]> => {
  const values: Record<string, string[]> = {};
  for (const el of controlsOf(form)) {
    const list = (values[el.name] ??= []);
    if (isChoice(el)) {
      if (el.defaultChecked) list.push(el.value);
    } else if (el instanceof HTMLSelectElement) {
      const option = [...el.options].find((o) => o.defaultSelected) ?? el.options[0];
      list.push(option?.value ?? '');
    } else {
      list.push(el.defaultValue);
    }
  }
  return values;
};

const sameValues = (a: Record<string, string[]>, b: Record<string, string[]>) =>
  JSON.stringify(a) === JSON.stringify(b);

/** 名前ごとの値を入力へ戻す。同じ名前の文字の入力は、並びの順に当てる */
const writeForm = (form: HTMLFormElement, values: Record<string, string[]>) => {
  const used: Record<string, number> = {};
  for (const el of controlsOf(form)) {
    const saved = values[el.name];
    if (saved === undefined) continue;
    if (isChoice(el)) {
      el.checked = saved.includes(el.value);
    } else {
      const index = used[el.name] ?? 0;
      used[el.name] = index + 1;
      if (index < saved.length) el.value = saved[index];
    }
  }
};

const read = (key: string): Draft | null => {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
};

const write = (key: string, draft: Draft) => {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(draft));
  } catch {
    // 保存領域が使えなければ持たない
  }
};

const remove = (key: string) => {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // 保存領域が使えなければ消すものも無い
  }
};

export const DraftRetention = ({
  storageKey,
  version = '',
  result,
}: {
  /** フォームごとに一意の名前。例: `project:new`、`project:{uid}` */
  storageKey: string;
  /** 編集を始めたときの更新日時。登録の画面では空 */
  version?: string;
  /** フォームの送った結果。変わったら（保存に失敗して戻ったら）入力を書き直す */
  result?: unknown;
}) => {
  const anchor = useRef<HTMLSpanElement>(null);
  // 戻したことの知らせ。保存領域はブラウザにしか無く、サーバーの描画と合わせるため、
  // 状態にせず、戻したときに要素を見せる
  const notice = useRef<HTMLSpanElement>(null);

  // 開いたときに戻し、入力のたびに書き、送るときに消す
  useEffect(() => {
    const form = anchor.current?.closest('form');
    if (!form) return;
    const defaults = readDefaults(form);
    const isDirty = () => !sameValues(readForm(form), defaults);
    const save = () =>
      isDirty() ? write(storageKey, { version, values: readForm(form) }) : remove(storageKey);
    const saved = read(storageKey);
    if (isDirty()) {
      // JavaScript が動き出す前の入力の方が新しい
      save();
    } else if (saved && saved.version === version) {
      writeForm(form, saved.values);
      if (notice.current) notice.current.hidden = false;
    } else if (saved) {
      remove(storageKey);
    }
    const clear = () => remove(storageKey);
    form.addEventListener('input', save);
    form.addEventListener('change', save);
    form.addEventListener('submit', clear);
    window.addEventListener('pagehide', save);
    return () => {
      form.removeEventListener('input', save);
      form.removeEventListener('change', save);
      form.removeEventListener('submit', clear);
      window.removeEventListener('pagehide', save);
    };
  }, [storageKey, version]);

  // 保存に失敗して同じ画面に戻ったら、送るときに消した入力を書き直す
  useEffect(() => {
    if (result === undefined || result === null) return;
    const form = anchor.current?.closest('form');
    if (form) write(storageKey, { version, values: readForm(form) });
  }, [result, storageKey, version]);

  const discard = () => {
    const form = anchor.current?.closest('form');
    remove(storageKey);
    form?.reset();
    if (notice.current) notice.current.hidden = true;
  };

  return (
    <span ref={anchor} className="contents">
      <span
        ref={notice}
        hidden
        role="status"
        className="flex flex-wrap items-center gap-3 text-sm [&[hidden]]:hidden"
      >
        保存していない入力を戻しました
        <button
          type="button"
          onClick={discard}
          className="rounded-md border border-input px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          戻した入力を捨てる
        </button>
      </span>
    </span>
  );
};
