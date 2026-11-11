'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * 管理画面の操作の結果の知らせ（「保存しました」など）。画面が URL の印（`?saved=1` など）を
 * 見て出す。
 *
 * - 出たときに、知らせへフォーカスを移す。保存に成功するとフォームが描き直され、フォーカスが
 *   画面の外へ落ちるため（HIG の Feedback、WCAG 2.2 SC 4.1.3・SC 2.4.3）
 * - 同じ画面で次にフォームを送ったら消す。次の送信の結果と並んで、古い知らせが残らないように
 *   する
 * - `flags` に渡した印を、出した後に URL から外す。再読み込みで同じ知らせを出さない。印が
 *   ほかの意味を持つ画面（note の編集の画面の `?saved=1` は書きかけを消す合図）は渡さない
 *
 * 同じ経路へ続けて移る画面（編集の画面の保存）は、呼び手が保存のたびに変わる `key` を渡し、
 * 知らせを置き直す
 */
export const SavedNotice = ({
  children,
  flags = [],
  className,
}: {
  children: ReactNode;
  flags?: string[];
  className?: string;
}) => {
  const ref = useRef<HTMLParagraphElement>(null);
  const [hidden, setHidden] = useState(false);
  const flagList = flags.join('\n');

  useEffect(() => {
    ref.current?.focus();
    if (flagList !== '') {
      const url = new URL(window.location.href);
      for (const flag of flagList.split('\n')) url.searchParams.delete(flag);
      window.history.replaceState(window.history.state, '', url);
    }
    const hide = () => setHidden(true);
    document.addEventListener('submit', hide, true);
    return () => document.removeEventListener('submit', hide, true);
  }, [flagList]);

  if (hidden) return null;
  return (
    <p ref={ref} role="status" tabIndex={-1} className={className}>
      {children}
    </p>
  );
};
