'use client';
// v2 の表現（上から下へ出す。帯ごとに追いつくずれ）を、HTML のページ全体にかける。
// 同じページを 3 枚重ねる
//   base: 本物。揃った部分だけを見せる。リンクは押せる
//   band: 写し。表示の境目がいる帯だけを見せ、上にずらす
//   streak: 写し。表示の境目の 1 行だけを切り抜き、下端まで縦に引き伸ばす
// 写しは見えるだけで、押せず、読み上げにも出さない
import { type ReactNode, useEffect, useRef, useState } from 'react';

// コマのスライダーの段数。再生中は段に丸めず、経過時間からなめらかに位置を出す
const STEPS = 2000;

export const DelayPage = ({
  base,
  band,
  streak,
}: {
  base: ReactNode;
  band: ReactNode;
  streak: ReactNode;
}) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  // 最初の値は、オーナーが v1 の最終版で選んだもの
  const [seconds, setSeconds] = useState(50);
  const [seam, setSeam] = useState(0.9);
  const [shift, setShift] = useState(0.01);
  const [count, setCount] = useState(6);
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
    if (!playing) return;
    const playMs = seconds * 1000;
    const start = performance.now() - (step / STEPS) * playMs;
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(STEPS, ((now - start) / playMs) * STEPS);
      setStep(next);
      if (next < STEPS) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // 再生を始めた時点の step から進める。秒数を変えたら、その時点の step から新しい速さで進め直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, seconds]);

  const h = height;
  const revealY = h * (step / STEPS);
  // いちばん上の内側の境目。seam は v1 と同じく「動かない側の反対からの割合」
  const seamY = h * (1 - seam);
  const gap = (h - seamY) / count;
  const maxShift = h * shift;
  // 表示の境目がいる帯。いちばん上の境目より上にいるときは帯なし
  const inBands = revealY >= seamY && gap > 0;
  const bandIndex = inBands ? Math.min(count - 1, Math.floor((revealY - seamY) / gap)) : -1;
  const bandTop = inBands ? seamY + bandIndex * gap : revealY;
  const u = inBands ? (revealY - bandTop) / gap : 1;
  // u = 0 で上に最大ずれ、u = 1 で揃う
  const offset = maxShift * (1 - u);
  // 本物で見せる下端。帯を通り終えたら（u = 1）境目まで、通っている間は帯の上端まで
  const alignedBottom = u >= 1 ? revealY : bandTop;
  const copyProps = { 'aria-hidden': true, inert: true } as const;
  // 重ねるのに欠かせない指定は、クラスの CSS が出ないことがあったので要素に直接書く
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
    <div style={{ position: 'relative', paddingBottom: 160 }}>
      <div
        ref={baseRef}
        style={{ clipPath: h ? `inset(0 0 ${h - alignedBottom}px 0)` : undefined }}
      >
        {base}
      </div>

      {inBands && u < 1 && revealY > bandTop && (
        <div
          {...copyProps}
          style={{ ...layer, clipPath: `inset(${bandTop}px 0 ${h - revealY}px 0)` }}
        >
          <div style={{ transform: `translateY(${-offset}px)` }}>{band}</div>
        </div>
      )}

      {h > 0 && revealY < h && (
        <div {...copyProps} style={layer}>
          <div
            style={{
              clipPath: `inset(${revealY}px 0 ${Math.max(0, h - revealY - 1)}px 0)`,
              // 引き伸ばしが数百倍を超えると、Chromium では縞が途中で止まったり乱れたりする（2026-11-04 に確かめた。深追いしていない）
              transformOrigin: '0 0',
              transform: `translateY(${revealY}px) scaleY(${h - revealY}) translateY(${-revealY}px)`,
            }}
          >
            {streak}
          </div>
        </div>
      )}

      {guides && h > 0 && (
        <div style={layer}>
          {Array.from({ length: count }, (_, k) => (
            <div
              key={k}
              style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                top: seamY + k * gap,
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
        <div className="mx-auto grid max-w-[640px] gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (step >= STEPS) setStep(0);
                setPlaying((value) => !value);
              }}
              className="h-9 shrink-0 rounded-full border border-foreground px-4"
            >
              {playing ? '止める' : '再生'}
            </button>
            <label className="flex flex-1 items-center gap-2">
              <span className="w-20 shrink-0 tabular-nums">コマ {Math.round(step)}</span>
              <input
                type="range"
                min={0}
                max={STEPS}
                value={step}
                onChange={(event) => {
                  setPlaying(false);
                  setStep(Number(event.target.value));
                }}
                className="flex-1"
              />
            </label>
          </div>
          <details>
            <summary className="cursor-pointer text-muted-foreground">設定</summary>
            <div className="grid gap-2 pt-2">
              {[
                {
                  label: `再生の長さ ${seconds} 秒`,
                  min: 4,
                  max: 120,
                  step: 1,
                  value: seconds,
                  set: setSeconds,
                },
                {
                  label: `内側の境目の位置 ${seam.toFixed(2)}`,
                  min: 0.1,
                  max: 0.9,
                  step: 0.01,
                  value: seam,
                  set: setSeam,
                },
                {
                  label: `帯ごとのずれの最大 高さの ${Math.round(shift * 100)}%`,
                  min: 0,
                  max: 0.2,
                  step: 0.005,
                  value: shift,
                  set: setShift,
                },
                {
                  label: `内側の境目の本数 ${count}`,
                  min: 1,
                  max: 60,
                  step: 1,
                  value: count,
                  set: setCount,
                },
              ].map(({ label, min, max, step: sliderStep, value, set }) => (
                <label key={label.split(' ')[0]} className="flex items-center gap-2">
                  <span className="w-52 shrink-0">{label}</span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={sliderStep}
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
                境目の線を出す（赤: 表示の境目、青: 内側の境目）
              </label>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
