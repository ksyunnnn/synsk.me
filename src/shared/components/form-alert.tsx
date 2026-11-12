import type { ReactNode } from 'react';

/** オーナーであることを確かめられなかったときの文言。入力を残さない操作（削除・切り替えなど）に出す */
export const FORBIDDEN_MESSAGE =
  'オーナーであることを確かめられませんでした。ログインし直してください';

/** オーナーであることを確かめられなかったときの文言。入力を受けるフォームに出す */
export const FORBIDDEN_INPUT_MESSAGE =
  'オーナーであることを確かめられませんでした。ログインし直してから入力し直してください';

/** 項目に不備があったときの、フォーム全体への文言 */
export const INVALID_INPUT_MESSAGE = '入力を確かめてください';

/**
 * 管理画面のフォームの操作の結果の通知（オーナーでない・入力に不備があるなど）。出たときに
 * 読み上げる（WCAG 2.2 SC 4.1.3）。使い手は各機能の管理画面のフォーム
 */
export const FormAlert = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="text-destructive">
    {children}
  </p>
);
