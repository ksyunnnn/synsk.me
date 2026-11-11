import type { ReactNode } from 'react';

/**
 * 管理画面の入力のフォームの、送信のボタンの行。フォームが画面に入っている間、画面の下端に
 * 留める。長いフォームでも、下までスクロールせずに保存のボタンへ届く（design/guidelines.md の
 * Getting started の「たどり着きたい情報 over 演出」、HIG の Toolbars）。
 *
 * 留めた行がフォーカスのある入力を隠さないよう、`src/app/globals.css` が、この行を持つ画面の
 * スクロールの下の余白を取る（WCAG 2.2 SC 2.4.11）。管理画面の `main` の左右の余白
 * （`px-4`）の分だけ横に広げ、境界の線を画面の端まで引く
 */
export const FormActions = ({ children }: { children: ReactNode }) => (
  <div
    data-form-actions=""
    className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t border-border bg-background px-4 py-3"
  >
    {children}
  </div>
);
