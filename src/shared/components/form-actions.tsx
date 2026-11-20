import type { ReactNode } from 'react';

/**
 * 管理画面の入力のフォームの、送信のボタンの行。フォームが画面に入っている間、画面の下端に
 * 留める。長いフォームでも、下までスクロールせずに保存のボタンへ届く（design/guidelines.md の
 * Getting started の「たどり着きたい情報 over 演出」、HIG の Toolbars）。
 *
 * 留めた行がフォーカスのある入力を隠さないよう、`src/app/globals.css` が、この行を持つ画面の
 * スクロールの下の余白を取る（WCAG 2.2 SC 2.4.11）。行はナビと操作の層なので、ガラスの面にして
 * 本文の上に浮かせる（HIG Materials）
 */
export const FormActions = ({ children }: { children: ReactNode }) => (
  <div
    data-form-actions=""
    className="glass sticky bottom-4 flex w-fit flex-wrap items-center gap-4 self-end rounded-full p-1.5"
  >
    {children}
  </div>
);
