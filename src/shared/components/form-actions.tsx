import type { ReactNode } from 'react';

/**
 * 管理画面の入力のフォームの、送信のボタンの行。フォームが画面に入っている間、画面の下端に
 * 留める。長いフォームでも、下までスクロールせずに保存のボタンへ届く（design/guidelines.md の
 * Getting started の「たどり着きたい情報 over 演出」、HIG の Toolbars）。
 *
 * 留めた行がフォーカスのある入力を隠さないよう、`src/app/globals.css` が、この行を持つ画面の
 * スクロールの下の余白を取る（WCAG 2.2 SC 2.4.11）。本文との境は、地の帯ではなく下端のぼかしで
 * 示す（HIG Layout の scroll edge effect）。浮いた面にすると入力欄を隠すため
 */
export const FormActions = ({ children }: { children: ReactNode }) => (
  <div
    data-form-actions=""
    className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-4 bg-gradient-to-t from-background from-60% to-transparent px-1 pt-8 pb-3"
  >
    {children}
  </div>
);
