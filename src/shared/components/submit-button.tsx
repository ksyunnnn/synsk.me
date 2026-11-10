'use client';

import type { ComponentPropsWithoutRef } from 'react';
import { useFormStatus } from 'react-dom';

/** 送っている間に、ボタンの名前の代わりに出す文言 */
export const PENDING_LABEL = '送っています…';

/**
 * 管理画面のフォームの送信のボタン。押してから応答が来るまで、名前を「送っています…」に変え、
 * 押せなくする。二度押しで同じ操作を 2 回送らない（HIG の Buttons、WCAG 2.2 SC 4.1.3）。
 * 動きは足さない（design/guidelines.md の Loading の「進み具合の見せ方」は未定）。
 *
 * 送っているかは、囲むフォームの状態を `useFormStatus` で読む。JavaScript なしでは、ふつうの
 * 送信のボタンとして動く。見た目は呼び手が `className` で渡す
 */
export const SubmitButton = ({
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<'button'>, 'type' | 'disabled'>) => {
  const { pending } = useFormStatus();
  return (
    <button {...props} type="submit" disabled={pending}>
      {pending ? PENDING_LABEL : children}
    </button>
  );
};
