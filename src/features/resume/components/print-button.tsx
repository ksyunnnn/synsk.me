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
    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring print:hidden"
  >
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
