'use client';

import { useActionState, type ReactNode } from 'react';

/**
 * 状態を変える操作のフォーム（画像の追加・代表画像の選択など）。成功したときは Server Action が
 * 別の画面へ移す。止めたときは、Server Action が返した理由の文言を出す。
 *
 * 送る値は隠しフィールドで持ち、入力の要素は `children` で受け取る。JavaScript なしでも送れる。
 * 使い手は note・実績・職歴の管理画面
 */

/** 止めた理由。成功したときは返らない */
export type OperationResult = { status: string };

type Props = {
  action: (state: OperationResult | null, formData: FormData) => Promise<OperationResult>;
  hidden: Record<string, string | number>;
  submitLabel: string;
  /** 止めた理由ごとの文言。無い理由には `commonMessages`、それも無ければ汎用の文言を出す */
  messages: Record<string, string>;
  /** 機能の中で共通の理由の文言 */
  commonMessages?: Record<string, string>;
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

export const OperationForm = ({
  action,
  hidden,
  submitLabel,
  messages,
  commonMessages = {},
  children,
  variant = 'secondary',
  label,
}: Props) => {
  const [result, formAction, pending] = useActionState(action, null);
  const message = result ? (messages[result.status] ?? commonMessages[result.status]) : null;
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
