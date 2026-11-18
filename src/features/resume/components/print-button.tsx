'use client';

import { TOOLBAR_ACTION } from '@/features/resume/components/toolbar-link';

/**
 * 「PDF で保存」のボタン（specs/002-resume/spec.md の FR-029・FR-030、research.md の R11）。
 * ブラウザの印刷の画面を開き、訪問者がそこで PDF に保存する。印刷するのは表示しているページで、
 * 中身は表示と同じ値になる。ボタンそのものは印刷に載せない。見た目は上の帯の操作（`TOOLBAR_ACTION`）
 */
export const PrintButton = () => (
  <button type="button" onClick={() => window.print()} className={TOOLBAR_ACTION}>
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
    PDF で保存
  </button>
);
