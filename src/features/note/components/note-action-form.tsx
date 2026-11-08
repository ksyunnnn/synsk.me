'use client';

import { useActionState, type ReactNode } from 'react';
import type { NoteOperationResult } from '@/features/note/domain/note';

/**
 * note の状態を変える操作のフォーム（公開・下書きに戻す・削除・戻す・過去の版に戻す・画像・
 * 代表画像・転載先・参照先の情報の取り直し）。成功したときは Server Action が別の画面へ移す。
 * 止めたときは、Server Action が返した理由の文言を出す（specs/003-note/contracts/dash.md）。
 *
 * 送る値は隠しフィールドで持ち、入力の要素は `children` で受け取る。JavaScript なしでも送れる
 */

type Props = {
  action: (state: NoteOperationResult | null, formData: FormData) => Promise<NoteOperationResult>;
  hidden: Record<string, string | number>;
  submitLabel: string;
  /** 止めた理由ごとの文言。無い理由には `fallback` を出す */
  messages: Record<string, string>;
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive';
  /** フォームを読み上げで呼ぶ名前 */
  label?: string;
};

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const BUTTONS = {
  primary: `rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50 ${FOCUS}`,
  secondary: `rounded-md border border-border px-4 py-2 disabled:opacity-50 ${FOCUS}`,
  destructive: `rounded-md bg-destructive px-4 py-2 text-destructive-foreground disabled:opacity-50 ${FOCUS}`,
} as const;

const COMMON_MESSAGES: Record<string, string> = {
  forbidden: 'オーナーであることを確かめられませんでした。ログインし直してください',
  'not-found': 'この note は見つかりませんでした',
  deleted: 'この note は削除されています。戻してから操作してください',
  conflict:
    'この note は、開いた後に別の画面で保存されていました。操作していません。開き直してから操作してください',
};

export const NoteActionForm = ({
  action,
  hidden,
  submitLabel,
  messages,
  children,
  variant = 'secondary',
  label,
}: Props) => {
  const [result, formAction, pending] = useActionState(action, null);
  const message = result ? (messages[result.status] ?? COMMON_MESSAGES[result.status]) : null;
  return (
    <form action={formAction} aria-label={label} className="flex flex-col gap-3">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      {result && (
        <p role="alert" className="text-destructive">
          {message ?? '操作できませんでした'}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className={BUTTONS[variant]}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
};
