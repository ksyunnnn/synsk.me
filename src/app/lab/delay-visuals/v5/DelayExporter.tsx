'use client';
// 自分の画像に v1 の最終版（横）か v2（縦）の表現をかけ、動画に書き出す
// 見本の canvas は書き出す動画と同じ画素数で描く。見本で見たものがそのまま動画になる
import { useEffect, useId, useRef, useState } from 'react';

import {
  drawFrame,
  exportVideo,
  FPS,
  isAcceptedAspect,
  outputSize,
  UnsupportedError,
  type Direction,
} from './encode';

// コマのスライダーの段数。再生中は段に丸めず、経過時間からなめらかに位置を出す
const STEPS = 2000;

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'horizontal', label: '横（右から左へ）' },
  { value: 'vertical', label: '縦（上から下へ）' },
];

type Picked = {
  name: string;
  width: number;
  height: number;
  source: HTMLCanvasElement;
  thumbnail: string;
};

type Exported = { url: string; file: File; width: number; height: number; seconds: number };

type ExportState =
  | { kind: 'idle' }
  | { kind: 'running'; done: number }
  | { kind: 'done'; result: Exported }
  | { kind: 'error'; message: string };

const focusRing =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

// 名前に書き出した日時（端末の時刻）を入れ、続けて書き出しても重ならないようにする
const fileName = (direction: Direction) => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `delay-visuals-${direction}-${date}-${time}.mp4`;
};

// 画像を選ぶ欄に出す縮小版の長い辺
const THUMBNAIL_SIZE = 192;

class AspectError extends Error {}

// 画像を読み、書き出す大きさに縮めた canvas にする。向きは画像の Exif に従う（ブラウザの既定）
// 透明な部分は白にする。動画は透明を持てない
const loadImage = (file: File) =>
  new Promise<Picked>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!isAcceptedAspect(img.naturalWidth, img.naturalHeight)) return reject(new AspectError());
      const { width, height } = outputSize(img.naturalWidth, img.naturalHeight);
      const source = document.createElement('canvas');
      source.width = width;
      source.height = height;
      const ctx = source.getContext('2d');
      if (!ctx) return reject(new Error('canvas を使えない'));
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      const ratio = THUMBNAIL_SIZE / Math.max(width, height);
      const thumbnail = document.createElement('canvas');
      thumbnail.width = Math.max(1, Math.round(width * ratio));
      thumbnail.height = Math.max(1, Math.round(height * ratio));
      thumbnail.getContext('2d')?.drawImage(source, 0, 0, thumbnail.width, thumbnail.height);
      resolve({
        name: file.name,
        width,
        height,
        source,
        thumbnail: thumbnail.toDataURL('image/jpeg', 0.8),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像を読めなかった'));
    };
    img.src = url;
  });

const Slider = ({
  label,
  value,
  display,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) => {
  const id = useId();
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="text-muted-foreground tabular-nums">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`h-11 w-full accent-foreground disabled:opacity-50 ${focusRing}`}
      />
    </div>
  );
};

export const DelayExporter = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>('horizontal');
  const [step, setStep] = useState(STEPS / 2);
  const [playing, setPlaying] = useState(false);
  // 最初の値は、オーナーが v1 の最終版で選んだもの
  const [seconds, setSeconds] = useState(50);
  const [seam, setSeam] = useState(0.9);
  const [shift, setShift] = useState(0.01);
  const [count, setCount] = useState(6);
  const [exportState, setExportState] = useState<ExportState>({ kind: 'idle' });
  const [canShare, setCanShare] = useState(false);

  const running = exportState.kind === 'running';
  const exportedUrl = exportState.kind === 'done' ? exportState.result.url : null;

  // 書き出した動画の URL は、次を書き出したときと、ページを離れたときに手放す
  useEffect(() => {
    if (!exportedUrl) return;
    return () => URL.revokeObjectURL(exportedUrl);
  }, [exportedUrl]);

  useEffect(() => () => abortRef.current?.abort(), []);

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
    if (!ctx || !picked) return;
    const { width, height, source } = picked;
    drawFrame(ctx, source, direction, { width, height, t: step / STEPS, seam, shift, count });
  }, [picked, direction, step, seam, shift, count]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPickError(null);
    setPlaying(false);
    try {
      setPicked(await loadImage(file));
      setExportState({ kind: 'idle' });
    } catch (error) {
      setPickError(
        error instanceof AspectError
          ? 'Instagram のストーリーに載せられる縦横比は 1:10 から 10:1 まで。その範囲の画像を選んでほしい。'
          : 'この画像は読めなかった。JPEG か PNG で試してほしい。',
      );
    }
  };

  const startExport = async () => {
    if (!picked) return;
    setPlaying(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setExportState({ kind: 'running', done: 0 });
    let lastPercent = 0;
    try {
      const { blob, width, height } = await exportVideo({
        image: picked.source,
        direction,
        settings: { seconds, seam, shift, count },
        // 描き直しを減らすため、1% 進むごとに知らせる
        onProgress: (done) => {
          const percent = Math.floor(done * 100);
          if (percent === lastPercent) return;
          lastPercent = percent;
          setExportState({ kind: 'running', done: percent / 100 });
        },
        signal: controller.signal,
      });
      const file = new File([blob], fileName(direction), { type: 'video/mp4' });
      setCanShare(
        typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }),
      );
      setExportState({
        kind: 'done',
        result: { url: URL.createObjectURL(blob), file, width, height, seconds },
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setExportState({ kind: 'idle' });
        return;
      }
      setExportState({
        kind: 'error',
        message:
          error instanceof UnsupportedError
            ? 'このブラウザは H.264 の動画を書き出せない。iPhone は iOS 16.4 以降の Safari で開いてほしい。'
            : '書き出しに失敗した。もう一度試してほしい。',
      });
    } finally {
      abortRef.current = null;
    }
  };

  const share = async (file: File) => {
    try {
      await navigator.share({ files: [file] });
    } catch {
      // 共有の画面を閉じたときも例外になる。何もしない
    }
  };

  const axis = direction === 'horizontal' ? '幅' : '高さ';

  return (
    <div className="grid gap-12">
      <section className="grid gap-4" aria-labelledby="pick-heading">
        <h2 id="pick-heading" className="text-xs tracking-wider text-muted-foreground">
          画像
        </h2>
        <label
          className={`flex cursor-pointer items-center gap-6 rounded-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ring ${running ? 'pointer-events-none opacity-50' : ''}`}
        >
          <input
            type="file"
            accept="image/*"
            disabled={running}
            className="sr-only"
            onChange={(event) => {
              void pick(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <span className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-sm bg-foreground/5">
            {picked ? (
              // 端末の中で作った data URL を出す。next/image の最適化は通せない
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picked.thumbnail} alt="" className="size-full object-cover" />
            ) : (
              <span aria-hidden className="text-2xl text-muted-foreground">
                +
              </span>
            )}
          </span>
          <span className="grid min-w-0 gap-2">
            <span className="text-xl break-all">{picked ? picked.name : '画像を選ぶ'}</span>
            <span className="text-sm text-muted-foreground">
              {picked
                ? `動画は ${picked.width}×${picked.height}。押すと選び直せる`
                : '動画の縦横比は、画像の縦横比になる'}
            </span>
          </span>
        </label>
        {pickError && (
          <p role="alert" className="text-sm text-destructive">
            {pickError}
          </p>
        )}
      </section>

      <fieldset className="grid gap-4" disabled={running}>
        <legend className="mb-4 text-xs tracking-wider text-muted-foreground">向き</legend>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-foreground/5 p-1">
          {DIRECTIONS.map(({ value, label }) => (
            <label
              key={value}
              className="grid h-11 cursor-pointer place-items-center rounded-full text-sm has-[:checked]:bg-foreground has-[:checked]:text-background has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
            >
              <input
                type="radio"
                name="direction"
                value={value}
                checked={direction === value}
                onChange={() => setDirection(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <section className="grid gap-4" aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="text-xs tracking-wider text-muted-foreground">
          見本
        </h2>
        {picked ? (
          <canvas
            ref={canvasRef}
            width={picked.width}
            height={picked.height}
            className="mx-auto block h-auto max-h-[60svh] w-auto max-w-full rounded-sm"
            role="img"
            aria-label={
              direction === 'horizontal'
                ? '選んだ画像を右から左へ出す見本'
                : '選んだ画像を上から下へ出す見本'
            }
          />
        ) : (
          <p className="grid aspect-[4/3] place-items-center rounded-sm bg-foreground/5 text-sm text-muted-foreground">
            画像を選ぶと、ここで動きを確かめられる
          </p>
        )}
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={!picked || running}
            onClick={() => {
              if (step >= STEPS) setStep(0);
              setPlaying((value) => !value);
            }}
            className={`h-11 shrink-0 rounded-full bg-foreground/5 px-5 text-sm disabled:opacity-50 ${focusRing}`}
          >
            {playing ? '止める' : '再生'}
          </button>
          <input
            type="range"
            aria-label="見本の位置"
            min={0}
            max={STEPS}
            value={step}
            disabled={!picked || running}
            onChange={(event) => {
              setPlaying(false);
              setStep(Number(event.target.value));
            }}
            className={`h-11 min-w-0 flex-1 accent-foreground disabled:opacity-50 ${focusRing}`}
          />
          <span className="w-14 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
            {((step / STEPS) * seconds).toFixed(1)} 秒
          </span>
        </div>
      </section>

      <section className="grid gap-6" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="text-xs tracking-wider text-muted-foreground">
          設定
        </h2>
        <Slider
          label="再生の長さ"
          value={seconds}
          display={`${seconds} 秒`}
          min={4}
          max={60}
          step={1}
          disabled={running}
          onChange={setSeconds}
        />
        <Slider
          label="内側の境目の位置"
          value={seam}
          display={seam.toFixed(2)}
          min={0.1}
          max={0.9}
          step={0.01}
          disabled={running}
          onChange={setSeam}
        />
        <Slider
          label="帯ごとのずれの最大"
          value={shift}
          display={`${axis}の ${Math.round(shift * 100)}%`}
          min={0}
          max={0.4}
          step={0.01}
          disabled={running}
          onChange={setShift}
        />
        <Slider
          label="内側の境目の本数"
          value={count}
          display={`${count} 本`}
          min={1}
          max={60}
          step={1}
          disabled={running}
          onChange={setCount}
        />
        <p className="text-sm text-muted-foreground">
          Instagram のストーリーに載せる動画は 60 秒までなので、再生の長さも 60 秒までにしている。
        </p>
      </section>

      <section className="grid gap-4" aria-labelledby="export-heading">
        <h2 id="export-heading" className="text-xs tracking-wider text-muted-foreground">
          書き出し
        </h2>
        {running ? (
          <div className="grid gap-3">
            <div
              role="progressbar"
              aria-label="書き出しの進み"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(exportState.done * 100)}
              className="h-1 overflow-hidden rounded-full bg-foreground/10"
            >
              <div
                className="h-full bg-foreground"
                style={{ width: `${exportState.done * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground tabular-nums">
                {Math.round(exportState.done * 100)}%（
                {Math.round(exportState.done * seconds * FPS)} / {seconds * FPS} コマ）
              </span>
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className={`h-11 rounded-full px-5 underline underline-offset-4 ${focusRing}`}
              >
                やめる
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={!picked}
            onClick={() => void startExport()}
            className={`h-11 rounded-full bg-foreground px-6 text-sm text-background disabled:opacity-50 ${focusRing}`}
          >
            動画を書き出す（MP4・{seconds} 秒）
          </button>
        )}
        {exportState.kind === 'error' && (
          <p role="alert" className="text-sm text-destructive">
            {exportState.message}
          </p>
        )}
        {exportState.kind === 'done' && (
          <div className="grid gap-4" aria-live="polite">
            <p className="text-sm text-muted-foreground">
              書き出した。{exportState.result.width}×{exportState.result.height}、
              {exportState.result.seconds} 秒、
              {(exportState.result.file.size / 1_000_000).toFixed(1)}MB。
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={exportState.result.url}
                download={exportState.result.file.name}
                className={`grid h-11 place-items-center rounded-full bg-foreground px-6 text-sm text-background ${focusRing}`}
              >
                ダウンロード
              </a>
              {canShare && (
                <button
                  type="button"
                  onClick={() => void share(exportState.result.file)}
                  className={`h-11 rounded-full bg-foreground/5 px-6 text-sm ${focusRing}`}
                >
                  共有
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
