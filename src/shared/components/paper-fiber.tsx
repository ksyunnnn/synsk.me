import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 黒塗りの面。docs/archive/assets/texture-prototype.html の Paper Fiber (18%) の質感を重ねる。
 * 面の色は foreground。大きさと位置は className と style で渡す。中身を置くときは、中身に
 * `relative` を付けて質感の上に描く
 */
const PAPER_FIBER = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='fiber'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.015 0.5' numOctaves='5' seed='3'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23fiber)'/%3E%3C/svg%3E")`;

export const PaperFiber = ({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) => (
  <div className={cn('relative isolate overflow-hidden bg-foreground', className)} style={style}>
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ backgroundImage: PAPER_FIBER, opacity: 0.18, mixBlendMode: 'soft-light' }}
    />
    {children}
  </div>
);
