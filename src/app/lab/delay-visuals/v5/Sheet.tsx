'use client';
// 画面の下から出るシート。高さは 2 段（medium: 画面の約半分、large: 画面いっぱい）
// 開いている間は後ろの画面を暗くする。後ろの画面を操作できなくするのは、呼ぶ側が inert で行う
// medium は上の帯と同じすりガラス、large は透かさない地にする
// 閉じ方: 閉じるボタン、暗くした部分を押す、下へ引く、Esc
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { XIcon as X } from '@phosphor-icons/react/dist/csr/X';

type Detent = 'medium' | 'large';

// medium の高さ。画面の高さに対する割合（HIG の Sheets「medium is about half of the fully expanded height」）
const MEDIUM = 0.5;
// large のとき、画面の上に残す隙間（px）。後ろに画面があることを示す
const LARGE_GAP = 8;
// 指を離したときの速さ（px/ms）がこれより速ければ、引いた向きの次の段へ移る
const FLICK = 0.5;

const focusRing =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const subscribeNothing = () => () => {};

const subscribeResize = (callback: () => void) => {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
};

export const Sheet = ({
  open,
  title,
  closeLabel,
  expandLabel,
  shrinkLabel,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  expandLabel: string;
  shrinkLabel: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [detent, setDetent] = useState<Detent>('medium');
  const [drag, setDrag] = useState<number | null>(null);
  const dragStart = useRef<{ y: number; time: number } | null>(null);
  // サーバーで描くときは何も出さない。ブラウザでだけ document.body へ出す
  const isClient = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const viewport = useSyncExternalStore(
    subscribeResize,
    () => window.innerHeight,
    () => 0,
  );

  // 次に開くときは medium から始める
  const close = () => {
    setDetent('medium');
    onClose();
  };
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  // 開いている間は、後ろの画面のスクロールを止め、フォーカスをシートへ移し、Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!isClient) return null;

  const height = Math.max(0, viewport - LARGE_GAP);
  // シートの上端を、いちばん高い位置から何 px 下げるか
  const offsets = { large: 0, medium: Math.max(0, height - viewport * MEDIUM), closed: height };
  const base = open ? offsets[detent] : offsets.closed;
  const offset = drag === null ? base : Math.min(offsets.closed, Math.max(0, base + drag));
  const opaque = open && detent === 'large' && drag === null;

  const release = (dy: number, velocity: number) => {
    const at = Math.min(offsets.closed, Math.max(0, base + dy));
    // 上から順に並べた止まる位置。速く引いたらその向きの次の位置、ゆっくりなら近い位置
    const stops: { name: Detent | 'closed'; at: number }[] = [
      { name: 'large', at: offsets.large },
      { name: 'medium', at: offsets.medium },
      { name: 'closed', at: offsets.closed },
    ];
    let next: Detent | 'closed';
    if (velocity > FLICK) next = stops.find((stop) => stop.at > at + 1)?.name ?? 'closed';
    else if (velocity < -FLICK)
      next = [...stops].reverse().find((stop) => stop.at < at - 1)?.name ?? 'large';
    else
      next = stops.reduce((best, stop) =>
        Math.abs(stop.at - at) < Math.abs(best.at - at) ? stop : best,
      ).name;
    if (next === 'closed') close();
    else setDetent(next);
  };

  // 閉じた後は見えなくし、押しても何も起きないようにする。閉じる動きを見せ終えてから消す
  const hiddenWhenClosed = open
    ? 'visible'
    : 'pointer-events-none invisible [transition:visibility_0s_linear_500ms]';

  return createPortal(
    <div lang="ja" className={`fixed inset-0 z-50 ${hiddenWhenClosed}`} aria-hidden={!open}>
      {/* 後ろの画面を暗くする。押すと閉じる */}
      <div
        aria-hidden
        onClick={close}
        className={`absolute inset-0 bg-foreground/40 transition-opacity duration-500 motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ height, transform: `translateY(${offset}px)` }}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-w-[640px] flex-col rounded-t-3xl outline-none ${
          drag === null
            ? 'transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none'
            : ''
        } ${opaque ? 'bg-background' : 'bg-background/85 backdrop-blur-xl'}`}
      >
        {/* 引いて高さを変える部分。つまみは、押すと高さを切り替えるボタンにもなる（HIG の Sheets の grabber） */}
        <div
          className="grid touch-none gap-1 px-4 pt-2 pb-2"
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest('[data-no-drag]')) return;
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // 押している指がもう離れているときは捕まえられない。引く動きはそのまま追う
            }
            dragStart.current = { y: event.clientY, time: performance.now() };
            setDrag(0);
          }}
          onPointerMove={(event) => {
            if (!dragStart.current) return;
            setDrag(event.clientY - dragStart.current.y);
          }}
          onPointerUp={(event) => {
            if (!dragStart.current) return;
            const dy = event.clientY - dragStart.current.y;
            const velocity = dy / Math.max(1, performance.now() - dragStart.current.time);
            dragStart.current = null;
            setDrag(null);
            if (Math.abs(dy) > 4) release(dy, velocity);
          }}
          onPointerCancel={() => {
            dragStart.current = null;
            setDrag(null);
          }}
        >
          <button
            type="button"
            data-no-drag
            aria-label={detent === 'medium' ? expandLabel : shrinkLabel}
            onClick={() => setDetent((value) => (value === 'medium' ? 'large' : 'medium'))}
            className={`mx-auto grid h-6 w-16 place-items-center rounded-full ${focusRing}`}
          >
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-muted-foreground/50" />
          </button>
          {/* 閉じるボタンは先頭側に置く（HIG の Sheets「the Cancel button belongs on the leading edge」） */}
          <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center">
            <button
              type="button"
              data-no-drag
              aria-label={closeLabel}
              onClick={close}
              className={`grid size-11 place-items-center rounded-full active:opacity-70 ${focusRing}`}
            >
              <X aria-hidden size={20} />
            </button>
            <h2 id={titleId} className="text-center text-base">
              {title}
            </h2>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};
