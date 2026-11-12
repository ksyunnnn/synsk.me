'use client';

import { useLinkStatus } from 'next/link';
import { cn } from '@/lib/utils';

/**
 * リンクを押してから移動が終わるまで出す点（issue #330）。`<Link>` の子孫に置く
 * （https://nextjs.org/docs/app/api-reference/functions/use-link-status）。
 *
 * 点は常に置いて場所を取り、不透明度だけを切り替える。読み込みの後に位置をずらさないため
 * （design/guidelines.md の Loading）。速い移動では出ないよう 100ms 遅らせて出す（同じ公式の
 * ページの例）。出ている間は息づきで往復し、移動が終われば消えて止まる。動きを減らす設定では
 * 往復させない（design/foundations.pen の Motion）。読み上げには出さない
 */
export const LinkPendingHint = () => {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2 shrink-0 rounded-full bg-foreground opacity-0 transition-opacity duration-200',
        pending && 'opacity-100 delay-100 motion-safe:animate-breathe',
      )}
    />
  );
};
