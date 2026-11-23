'use client';

import { useEffect, useRef, useSyncExternalStore, type ComponentPropsWithoutRef } from 'react';
import { useFormStatus } from 'react-dom';

/** 送っている間に、ボタンの名前の代わりに出す文言 */
const PENDING_LABEL = '送っています…';

/**
 * 送っているフォームの id。フォームの外に置いたボタン（`form` 属性で送る）は `useFormStatus` で
 * 状態を読めないため、フォームが `useReportPending` で知らせる
 */
const pendingForms = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** フォームの外のボタンに、送っているかを知らせる。値は `useActionState` の 3 つめの値を渡す */
export const useReportPending = (formId: string | undefined, pending: boolean) => {
  useEffect(() => {
    if (!formId) return;
    if (pending) pendingForms.add(formId);
    else pendingForms.delete(formId);
    notify();
    return () => {
      pendingForms.delete(formId);
      notify();
    };
  }, [formId, pending]);
};

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
 * 送っているかは、囲むフォームの状態を `useFormStatus` で読む。`form` 属性でフォームの外に置いた
 * ときは、そのフォームが `useReportPending` で知らせた状態を読む。送り終えたことは、送っている
 * 状態が終わったことで知る。保存に成功した画面は移るか描き直され、このボタンは残らない。
 * JavaScript なしでは、ふつうの送信のボタンとして動く。見た目は呼び手が `className` で渡す
 */
export const SubmitButton = ({
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<'button'>, 'type' | 'disabled'>) => {
  const status = useFormStatus();
  const outside = useSyncExternalStore(
    subscribe,
    () => (props.form ? pendingForms.has(props.form) : false),
    () => false,
  );
  const pending = props.form ? outside : status.pending;
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
