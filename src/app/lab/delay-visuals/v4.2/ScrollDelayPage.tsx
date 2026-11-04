'use client';
// v4 の部品を写し、表示の境目の高さをスクロールで変える。
// 表示の境目は、最初の 1 画面ぶんスクロールするあいだに画面の上から lineStart から lineEnd の割合へ動き、その先は lineEnd に留まる
// 帯はページの上から下まで決まった高さで並べ、表示の境目がその帯を通る間だけ、v2 と同じく追いついて揃うずれを出す
// 縦の縞は、表示の境目から画面の下端までだけを描く（画面の外は見えないので、引き伸ばしを小さく抑える）
// 同じページを 3 枚重ねる作りは v3.2 と同じ。重ねるのに欠かせない指定は要素の style に直接書く
import { type ReactNode, useEffect, useRef, useState } from 'react';

export const ScrollDelayPage = ({
  base,
  band,
  streak,
}: {
  base: ReactNode;
  band: ReactNode;
  streak: ReactNode;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  // 画面の上端と下端の、ページの中での位置
  // scrolled はページ全体のスクロール量
  const [view, setView] = useState({ top: 0, bottom: 0, scrolled: 0 });
  const [lineStart, setLineStart] = useState(0.3);
  const [lineEnd, setLineEnd] = useState(0.64);
  const [bandHeight, setBandHeight] = useState(160);
  const [shift, setShift] = useState(8);
  const [guides, setGuides] = useState(false);

  useEffect(() => {
    const element = baseRef.current;
    if (!element) return;
    // 画像の読み込みなどで高さが変わるので、変わるたびに測り直す
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const root = rootRef.current;
      if (!root) return;
      const top = -root.getBoundingClientRect().top;
      setView({ top, bottom: top + window.innerHeight, scrolled: window.scrollY });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const h = height;
  const viewHeight = view.bottom - view.top;
  // 最初の 1 画面ぶんのスクロールで 0 から 1 へ進む
  const progress = viewHeight ? Math.min(1, Math.max(0, view.scrolled / viewHeight)) : 0;
  const line = lineStart + (lineEnd - lineStart) * progress;
  const revealY = Math.min(h, Math.max(0, view.top + viewHeight * line));
  const bandIndex = Math.floor(revealY / bandHeight);
  const bandTop = bandIndex * bandHeight;
  const u = (revealY - bandTop) / bandHeight;
  // u = 0 で上に最大ずれ、u = 1 で揃う
  const offset = shift * (1 - u);
  const done = revealY >= h;
  // 縞は画面の下端までで止める
  const streakBottom = Math.min(h, view.bottom);
  const copyProps = { 'aria-hidden': true, inert: true } as const;
  const layer = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: h,
    pointerEvents: 'none',
    overflow: 'hidden',
  } as const;

  return (
    // 下に画面 1 枚ぶんの余白を置き、ページの最後まで表示の境目が届くようにする
    <div ref={rootRef} style={{ position: 'relative', paddingBottom: '100vh' }}>
      <div
        ref={baseRef}
        style={{ clipPath: h && !done ? `inset(0 0 ${h - bandTop}px 0)` : undefined }}
      >
        {base}
      </div>

      {h > 0 && !done && revealY > bandTop && (
        <div
          {...copyProps}
          // 上端を 1px 上に広げて下地と重ねる。境目が画素の区切りに乗らないと、両方が半分の濃さで描かれて背景の白が透ける
          style={{
            ...layer,
            clipPath: `inset(${Math.max(0, bandTop - 1)}px 0 ${h - revealY}px 0)`,
          }}
        >
          <div style={{ transform: `translateY(${-offset}px)` }}>{band}</div>
        </div>
      )}

      {h > 0 && !done && streakBottom > revealY && (
        <div {...copyProps} style={layer}>
          <div
            style={{
              clipPath: `inset(${revealY}px 0 ${Math.max(0, h - revealY - 1)}px 0)`,
              transformOrigin: '0 0',
              transform: `translateY(${revealY}px) scaleY(${streakBottom - revealY}) translateY(${-revealY}px)`,
            }}
          >
            {streak}
          </div>
        </div>
      )}

      {guides && h > 0 && (
        <div style={layer}>
          {Array.from({ length: Math.ceil(h / bandHeight) }, (_, k) => (
            <div
              key={k}
              style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                top: k * bandHeight,
                borderTop: '2px dashed #3e63dd',
              }}
            />
          ))}
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: '100%',
              top: Math.min(h - 2, revealY),
              borderTop: '2px dashed #e5484d',
            }}
          />
        </div>
      )}

      <div
        className="border-t border-border px-4 py-3 text-sm"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          background: 'hsl(var(--background))',
        }}
      >
        <details className="mx-auto max-w-[640px]">
          <summary className="cursor-pointer text-muted-foreground">
            設定（スクロールすると表示の境目が進む）
          </summary>
          <div className="grid gap-2 pt-2">
            {[
              {
                label: `表示の境目の高さ 始め 画面の上から ${Math.round(lineStart * 100)}%`,
                min: 0.1,
                max: 1,
                step: 0.01,
                value: lineStart,
                set: setLineStart,
              },
              {
                label: `表示の境目の高さ 1 画面スクロールした後 ${Math.round(lineEnd * 100)}%`,
                min: 0.1,
                max: 1,
                step: 0.01,
                value: lineEnd,
                set: setLineEnd,
              },
              {
                label: `帯の高さ ${bandHeight}px`,
                min: 20,
                max: 600,
                step: 10,
                value: bandHeight,
                set: setBandHeight,
              },
              {
                label: `帯ごとのずれの最大 ${shift}px`,
                min: 0,
                max: 120,
                step: 1,
                value: shift,
                set: setShift,
              },
            ].map(({ label, min, max, step, value, set }) => (
              <label key={label.split(' ')[0]} className="flex items-center gap-2">
                <span className="w-60 shrink-0">{label}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  onChange={(event) => set(Number(event.target.value))}
                  className="flex-1"
                />
              </label>
            ))}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={guides}
                onChange={(event) => setGuides(event.target.checked)}
              />
              境目の線を出す（赤: 表示の境目、青: 帯の境目）
            </label>
          </div>
        </details>
      </div>
    </div>
  );
};
