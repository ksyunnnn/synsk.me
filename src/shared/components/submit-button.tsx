'use client';

import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { useFormStatus } from 'react-dom';

/** 送っている間に、ボタンの名前の代わりに出す文言 */
export const PENDING_LABEL = '送っています…';

/**
 * 送った結果が失敗のときに、フォーカスを移す先。最初の誤りの項目を選び、項目ごとの誤りが
 * 無い失敗（先の保存・オーナーの確認）は理由の文言を選ぶ。どちらも無ければ移さない
 */
const findFailure = (form: HTMLFormElement) =>
  form.querySelector<HTMLElement>('[aria-invalid="true"]') ??
  form.querySelector<HTMLElement>('[role="alert"]');

/**
 * 管理画面のフォームの送信のボタン。
 *
 * - 押してから応答が来るまで、名前を「送っています…」に変え、押せなくする。二度押しで同じ
 *   操作を 2 回送らない（HIG の Buttons、WCAG 2.2 SC 4.1.3）。動きは足さない
 *   （design/guidelines.md の Loading の「進み具合の見せ方」は未定）
 * - 応答が失敗の結果を描いたら、最初の誤りの項目か理由の文言へフォーカスを移す。長いフォームで
 *   ボタンの位置に留まると、誤りが画面の外にあり、何も変わらないように見えるため（HIG の
 *   Feedback、WCAG 2.2 SC 3.3.1・SC 2.4.3）。理由の文言はフォーカスを受けられるようにする
 *
 * 送っているかは、囲むフォームの状態を `useFormStatus` で読む。送り終えたことは、送っている
 * 状態が終わったことで知る。保存に成功した画面は移るか描き直され、このボタンは残らない。
 * JavaScript なしでは、ふつうの送信のボタンとして動く。見た目は呼び手が `className` で渡す
 */
export const SubmitButton = ({
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<'button'>, 'type' | 'disabled'>) => {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    const form = ref.current?.form;
    if (!finished || !form) return;
    const target = findFailure(form);
    if (!target) return;
    if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus();
  }, [pending]);

  return (
    <button {...props} ref={ref} type="submit" disabled={pending}>
      {pending ? PENDING_LABEL : children}
    </button>
  );
};
