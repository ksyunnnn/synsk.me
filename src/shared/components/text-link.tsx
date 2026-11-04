import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * 文中と管理画面の移動のリンク。下線とフォーカスの見た目をかぶせる（design/guidelines.md の
 * Inputs）。使い手は 001 の管理画面の各ページ
 */
export const TextLink = ({ className, ...props }: ComponentProps<typeof Link>) => (
  <Link
    {...props}
    className={cn(
      'underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      className,
    )}
  />
);
