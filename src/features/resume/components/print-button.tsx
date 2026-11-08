'use client';

/**
 * 「PDF で保存」のボタン（specs/002-resume/spec.md の FR-029・FR-030、research.md の R11）。
 * ブラウザの印刷の画面を開き、訪問者がそこで PDF に保存する。印刷するのは表示しているページで、
 * 中身は表示と同じ値になる。ボタンそのものは印刷に載せない
 */
export const PrintButton = () => (
  <button
    type="button"
    onClick={() => window.print()}
    className="rounded-md border border-input px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring print:hidden"
  >
    PDF で保存
  </button>
);
