'use client';
// v1 の最終版（帯ごとに追いつく）を縦にしたもの。写真を上から下へ出す。
// 表示の境目: 下へ進む。その下は、境目の行の色を列ごとに下端まで引き伸ばす
// 内側の境目: 写真の上で動かない横線。いちばん上の境目より上はそのまま。
//   その下は下端まで等しい間隔で帯に分け、表示の境目が帯に入るとき絵は上に最大ずれていて、次の境目に届くまでに下へ動いて揃う
// 写真を複数渡すと canvas を横に並べ、再生・コマ・設定を共有して同時に動かす
import { useEffect, useRef, useState } from 'react';

const WIDTH = 400;
const HEIGHT = 900;
// コマのスライダーの段数。再生中は段に丸めず、経過時間からなめらかに位置を出す
const STEPS = 2000;

// x と y は、写真から 4:9 を切り取るときの位置（0〜1。0.5 で中央）
// zoom は切り取る範囲を小さくする倍率（省略で 1。1 のとき、写真に収まるいちばん大きい 4:9 を切り取る）
type Photo = { url: string; x: number; y: number; zoom?: number };

type Settings = { t: number; seam: number; shift: number; count: number; guides: boolean };

const cropPhoto = (img: HTMLImageElement, photo: Photo) => {
  const aspect = WIDTH / HEIGHT;
  const wide = img.naturalWidth / img.naturalHeight > aspect;
  const zoom = photo.zoom ?? 1;
  const cropWidth = (wide ? img.naturalHeight * aspect : img.naturalWidth) / zoom;
  const cropHeight = (wide ? img.naturalHeight : img.naturalWidth / aspect) / zoom;
  const crop = document.createElement('canvas');
  crop.width = cropWidth;
  crop.height = cropHeight;
  crop
    .getContext('2d')
    ?.drawImage(
      img,
      (img.naturalWidth - cropWidth) * photo.x,
      (img.naturalHeight - cropHeight) * photo.y,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight,
    );
  return crop;
};

const draw = (
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  { t, seam, shift, count, guides }: Settings,
) => {
  const scale = image.width / WIDTH;
  // いちばん上の内側の境目。seam は v1 と同じく「動かない側の反対からの割合」
  const seamY = HEIGHT * (1 - seam);
  const revealY = HEIGHT * t;
  const gap = (HEIGHT - seamY) / count;
  const maxShift = HEIGHT * shift;

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  // いちばん上の境目より上: そのまま
  ctx.drawImage(image, 0, 0, image.width, seamY * scale, 0, 0, WIDTH, seamY);
  // その下の帯: u は表示の境目がその帯の上端から何帯ぶん進んだか。u = 0 で上に最大ずれ、u = 1 で揃う
  for (let k = 1; k <= count; k++) {
    const top = seamY + (k - 1) * gap;
    const u = (revealY - top) / gap;
    const offset = u >= 1 ? 0 : maxShift * (1 - Math.max(0, u));
    ctx.drawImage(image, 0, (top + offset) * scale, image.width, gap * scale, 0, top, WIDTH, gap);
  }
  // 表示の境目より下: 境目の行を下端まで引き伸ばす
  if (revealY < HEIGHT) {
    const row = Math.max(0, Math.floor(revealY));
    ctx.drawImage(ctx.canvas, 0, row, WIDTH, 1, 0, row, WIDTH, HEIGHT - row);
  }
  if (guides) {
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3e63dd';
    for (let k = 0; k < count; k++) {
      const y = seamY + k * gap;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }
    // 端に来たときも見えるように、線を canvas の内側に収める
    const lineY = Math.min(HEIGHT - 1, Math.max(1, revealY));
    ctx.strokeStyle = '#e5484d';
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(WIDTH, lineY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
};

const Frame = ({ photo, settings }: { photo: Photo; settings: Settings }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(cropPhoto(img, photo));
    img.src = photo.url;
    // photo は url・x・y・zoom で同じかを判断する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.url, photo.x, photo.y, photo.zoom]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !image) return;
    draw(ctx, image, settings);
  }, [image, settings]);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      className="mx-auto w-full rounded-md bg-muted"
      style={{ maxWidth: 320 }}
      role="img"
      aria-label="縦長の写真を上から下へ出す。2 本の境目で描く"
    />
  );
};

export const VerticalReveal = ({ photos }: { photos: Photo[] }) => {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  // 最初の値は、オーナーが v1 の最終版で選んだもの
  const [seconds, setSeconds] = useState(50);
  const [seam, setSeam] = useState(0.9);
  const [shift, setShift] = useState(0.01);
  const [count, setCount] = useState(6);
  const [guides, setGuides] = useState(false);

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

  const settings: Settings = { t: step / STEPS, seam, shift, count, guides };

  const sliders = [
    {
      label: `再生の長さ ${seconds} 秒`,
      min: 4,
      max: 60,
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
      max: 0.4,
      step: 0.01,
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
  ];

  return (
    <div className="grid gap-4">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${photos.length}, minmax(0, 1fr))` }}
      >
        {photos.map((photo) => (
          <Frame key={photo.url} photo={photo} settings={settings} />
        ))}
      </div>
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
        {sliders.map(({ label, min, max, step: sliderStep, value, set }) => (
          <label key={label.split(' ')[0]} className="flex items-center gap-2">
            <span className="w-48 shrink-0">{label}</span>
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
    </div>
  );
};
