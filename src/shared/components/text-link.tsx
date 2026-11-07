import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * 管理画面の移動のリンク。下線とフォーカスの見た目をかぶせる（design/guidelines.md の Inputs）。
 * 使い手は 001 の管理画面の各ページ。
 *
 * 既定で先読み（prefetch）しない。vinext 1.2 は、動的なセグメントを持たない経路
 * （`/dash/projects` など）を、リンクが見えた時点で RSC ごと取りに行き、移るときに使う
 * （`vinext/dist/shims/internal/app-route-prefetch-policy.js` の `resolveAutoAppRoutePrefetch`）。
 * 管理画面の中身は要求のたびに読む（docs/REQUIREMENTS.md の NFR-09）ため、先に読んだ中身を
 * 使わせない
 */
export const TextLink = ({
  className,
  prefetch = false,
  ...props
}: ComponentProps<typeof Link>) => (
  <Link
    {...props}
    prefetch={prefetch}
    className={cn(
      'underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      className,
    )}
  />
);
