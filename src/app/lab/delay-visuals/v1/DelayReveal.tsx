'use client';
// 横長の写真を右から左へ出す。2 本の境目で描く。
// 表示の境目: 左へ進む。その左は、境目の列の色を行ごとに左端まで引き伸ばす
// 内側の境目: 写真の上で動かない。その右はそのまま。左の描き方は 2 通り
//   stretch: 時間とともに左へ引き伸ばす
//   shift: 同じ写真の 2 枚目を、時間とともに大きく左へずらして出す
//   repeat: 内側の境目を左端まで等しい間隔で何本も置き、境目を 1 本越えるごとに一段ずつ左へずらす
//   settle: 帯の置き方は repeat と同じ。表示の境目がその帯を通る間だけずれる。帯に入るときと次の青線に届いたときは 0、真ん中で最大
//   catchup: 帯の置き方は repeat と同じ。表示の境目が帯に入るとき絵は右に最大ずれていて、次の青線に届くまでに左へ動いて揃う
import { useEffect, useRef, useState } from 'react';

const DEFAULT_PHOTO = { url: 'https://picsum.photos/id/20/1800/600', top: 0 };
const WIDTH = 900;
const HEIGHT = 300;
// コマのスライダーの段数。再生中は段に丸めず、経過時間からなめらかに位置を出す
const STEPS = 2000;

export const DelayReveal = ({
  mode,
  photo = DEFAULT_PHOTO,
}: {
  mode: 'stretch' | 'shift' | 'repeat' | 'settle' | 'catchup';
  // top は写真の高さに対する、切り取りを始める位置（0〜1）。canvas と同じ 3:1 の帯を切り取る
  photo?: { url: string; top: number };
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  // 最終版（catchup）の最初の値は、オーナーが選んだもの
  const final = mode === 'catchup';
  const [seam, setSeam] = useState(final ? 0.9 : 0.55);
  const [stretch, setStretch] = useState(1.4);
  const [shift, setShift] = useState(final ? 0.01 : mode === 'settle' ? 0.06 : 0.12);
  const [count, setCount] = useState(final ? 6 : 8);
  const [guides, setGuides] = useState(!final);
  const [seconds, setSeconds] = useState(final ? 50 : 20);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 写真から 3:1 の帯を切り取って、描くときの元にする
      const cropHeight = img.naturalWidth / 3;
      const top = Math.min(img.naturalHeight - cropHeight, img.naturalHeight * photo.top);
      const crop = document.createElement('canvas');
      crop.width = img.naturalWidth;
      crop.height = cropHeight;
      crop
        .getContext('2d')
        ?.drawImage(img, 0, top, img.naturalWidth, cropHeight, 0, 0, crop.width, crop.height);
      setImage(crop);
    };
    img.src = photo.url;
  }, [photo.url, photo.top]);

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

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !image) return;
    const t = step / STEPS;
    const scale = image.width / WIDTH;
    const seamX = WIDTH * seam;
    const revealX = WIDTH * (1 - t);
    const s = 1 + (stretch - 1) * t;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (mode === 'stretch') {
      // 内側の境目より左: 写真の [seamX - seamX / s, seamX] を [0, seamX] に引き伸ばす
      const srcWidth = seamX / s;
      ctx.drawImage(
        image,
        (seamX - srcWidth) * scale,
        0,
        srcWidth * scale,
        image.height,
        0,
        0,
        seamX,
        HEIGHT,
      );
    } else if (mode === 'repeat') {
      // 左から k 番目の帯（右から数えて k 本目の境目の左）は、写真を step × k だけ左へずらす
      const gap = seamX / count;
      const stepShift = (WIDTH * shift * t) / count;
      for (let k = 1; k <= count; k++) {
        const right = seamX - (k - 1) * gap;
        const left = seamX - k * gap;
        ctx.drawImage(
          image,
          (left + stepShift * k) * scale,
          0,
          gap * scale,
          image.height,
          left,
          0,
          right - left,
          HEIGHT,
        );
      }
    } else if (mode === 'catchup') {
      // u は表示の境目がその帯の右端から何帯ぶん進んだか。u = 0 で右に最大ずれ、u = 1 で揃う
      const gap = seamX / count;
      const maxShift = WIDTH * shift;
      for (let k = 1; k <= count; k++) {
        const right = seamX - (k - 1) * gap;
        const left = seamX - k * gap;
        const u = (right - revealX) / gap;
        const offset = u >= 1 ? 0 : maxShift * (1 - Math.max(0, u));
        ctx.drawImage(
          image,
          (left - offset) * scale,
          0,
          gap * scale,
          image.height,
          left,
          0,
          right - left,
          HEIGHT,
        );
      }
    } else if (mode === 'settle') {
      // u は表示の境目がその帯の右端から何帯ぶん進んだか。0 と 1 でずれ 0、0.5 で最大
      const gap = seamX / count;
      const maxShift = WIDTH * shift;
      for (let k = 1; k <= count; k++) {
        const right = seamX - (k - 1) * gap;
        const left = seamX - k * gap;
        const u = (right - revealX) / gap;
        const amount = u <= 0 || u >= 1 ? 0 : 1 - Math.abs(2 * u - 1);
        ctx.drawImage(
          image,
          (left + maxShift * amount) * scale,
          0,
          gap * scale,
          image.height,
          left,
          0,
          right - left,
          HEIGHT,
        );
      }
    } else {
      // 内側の境目より左: 2 枚目の写真を d だけ左へずらす。写真の [d, seamX + d] を [0, seamX] に出す
      const d = WIDTH * shift * t;
      ctx.drawImage(image, d * scale, 0, seamX * scale, image.height, 0, 0, seamX, HEIGHT);
    }
    // 内側の境目より右: そのまま
    ctx.drawImage(
      image,
      seamX * scale,
      0,
      (WIDTH - seamX) * scale,
      image.height,
      seamX,
      0,
      WIDTH - seamX,
      HEIGHT,
    );
    // 表示の境目より左: 境目の列を左端まで引き伸ばす
    if (revealX > 0) {
      const column = Math.min(WIDTH - 1, Math.floor(revealX));
      ctx.drawImage(ctx.canvas, column, 0, 1, HEIGHT, 0, 0, column, HEIGHT);
    }
    if (guides) {
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#e5484d';
      ctx.beginPath();
      // 端に来たときも見えるように、線を canvas の内側に収める
      const lineX = Math.min(WIDTH - 1, Math.max(1, revealX));
      ctx.moveTo(lineX, 0);
      ctx.lineTo(lineX, HEIGHT);
      ctx.stroke();
      ctx.strokeStyle = '#3e63dd';
      const seams =
        mode === 'repeat' || mode === 'settle' || mode === 'catchup'
          ? Array.from({ length: count }, (_, index) => seamX - (index * seamX) / count)
          : [seamX];
      for (const x of seams) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }, [image, step, seam, stretch, shift, count, guides, mode]);

  return (
    <div className="grid gap-4">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="w-full rounded-md bg-muted"
        role="img"
        aria-label="横長の写真を右から左へ出す。2 本の境目で描く"
      />
      <div className="grid gap-3 text-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (step >= STEPS) setStep(0);
              setPlaying((value) => !value);
            }}
            className="h-9 rounded-full border border-foreground px-4"
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
        <label className="flex items-center gap-2">
          <span className="w-48 shrink-0">再生の長さ {seconds} 秒</span>
          <input
            type="range"
            min={4}
            max={60}
            step={1}
            value={seconds}
            onChange={(event) => setSeconds(Number(event.target.value))}
            className="flex-1"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-48 shrink-0">内側の境目の位置 {seam.toFixed(2)}</span>
          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.01}
            value={seam}
            onChange={(event) => setSeam(Number(event.target.value))}
            className="flex-1"
          />
        </label>
        {mode === 'stretch' ? (
          <label className="flex items-center gap-2">
            <span className="w-48 shrink-0">引き伸ばしの最大 {stretch.toFixed(2)} 倍</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={stretch}
              onChange={(event) => setStretch(Number(event.target.value))}
              className="flex-1"
            />
          </label>
        ) : (
          <label className="flex items-center gap-2">
            <span className="w-48 shrink-0">
              {mode === 'repeat'
                ? 'ずれの合計の最大'
                : mode === 'settle' || mode === 'catchup'
                  ? '帯ごとのずれの最大'
                  : 'ずれの最大'}{' '}
              幅の {Math.round(shift * 100)}%
            </span>
            <input
              type="range"
              min={0}
              max={0.4}
              step={0.01}
              value={shift}
              onChange={(event) => setShift(Number(event.target.value))}
              className="flex-1"
            />
          </label>
        )}
        {(mode === 'repeat' || mode === 'settle' || mode === 'catchup') && (
          <label className="flex items-center gap-2">
            <span className="w-48 shrink-0">内側の境目の本数 {count}</span>
            <input
              type="range"
              min={1}
              max={60}
              step={1}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="flex-1"
            />
          </label>
        )}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={guides}
            onChange={(event) => setGuides(event.target.checked)}
          />
          境目の線を出す（赤: 表示の境目、青: 内側の境目）
        </label>
      </div>
    </div>
  );
};
