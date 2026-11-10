'use client';
// 自分の写真に v1 の最終版（横）か v2（縦）の表現をかけ、動画に書き出す
// プレビューの canvas は書き出す動画と同じ画素数で描く。プレビューで見たものがそのまま動画になる
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  DownloadSimple,
  Export,
  ImageSquare,
  Pause,
  Play,
  SlidersHorizontal,
} from '@phosphor-icons/react';

import { sourceSans } from '@/lib/fonts';

import {
  drawFrame,
  exportVideo,
  isAcceptedAspect,
  outputSize,
  UnsupportedError,
  type Direction,
} from './encode';
import { drawGuides } from './guides';
import { Credit, LabBackLink } from './RouteLinks';
import { Sheet } from './Sheet';

// 再生位置のスライダーの段数。再生中は段に丸めず、経過時間からなめらかに位置を出す
const STEPS = 2000;

// 最初の値と「リセット」で戻す値。長さはオーナーが 15 秒に決めた。ほかは、オーナーが v1 の最終版で選んだもの
const DEFAULTS = { seconds: 15, shift: 0.005, count: 6 };

// 遅れる範囲は写真の全体に固定する。オーナーが変えられなくてよいと決めた
const SEAM = 1;

// 画面に出す言葉。出典は PR の本文にある
const COPY = {
  tagline: '写真が端から現れながら、何度か少しずれては元の位置に戻る動画をつくる。',
  choose: '写真を選択',
  chooseHint: '動画の縦横比は写真と同じになる',
  change: '写真を置き換える',
  play: '再生',
  pause: '一時停止',
  position: '再生位置',
  guides: '補助線',
  direction: '方向',
  rightToLeft: '右から左',
  topToBottom: '上から下',
  duration: '長さ',
  amount: 'ずれの大きさ',
  strips: 'ずれの回数',
  reset: 'リセット',
  adjust: '調整',
  close: '閉じる',
  expand: '大きく表示',
  shrink: '小さく表示',
  export: '書き出す',
  exporting: '書き出し中',
  cancel: 'キャンセル',
  done: '書き出し完了',
  downloadHint: 'ダウンロードした動画は、「ファイル」App の「ダウンロード」フォルダに入ります。',
  download: 'ダウンロード',
  share: '共有',
  aspectError:
    '縦横比が 1:10 から 10:1 の写真を選んでください。Instagram のストーリーに載せられる範囲です。',
  readError: 'この写真は読み込めませんでした。JPEG か PNG で試してください。',
  unsupported:
    'このブラウザでは動画を書き出せません。iPhone は iOS 16.4 以降の Safari で開いてください。',
  failed: '書き出せませんでした。もう一度試してください。',
} as const;

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'horizontal', label: COPY.rightToLeft },
  { value: 'vertical', label: COPY.topToBottom },
];

type Picked = { width: number; height: number; source: HTMLCanvasElement };

type Exported = { url: string; file: File };

type ExportState =
  | { kind: 'idle' }
  | { kind: 'running'; done: number }
  | { kind: 'done'; result: Exported }
  | { kind: 'error'; message: string };

const focusRing =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

// 秒を 0:12 の形にする
const clock = (seconds: number) => {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

// 名前に書き出した日時（端末の時刻）を入れ、続けて書き出しても重ならないようにする
const fileName = (direction: Direction) => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `delay-visuals-${direction}-${date}-${time}.mp4`;
};

class AspectError extends Error {}

// 写真を読み、書き出す大きさに縮めた canvas にする。向きは写真の Exif に従う（ブラウザの既定）
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
      resolve({ width, height, source });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('写真を読めなかった'));
    };
    img.src = url;
  });

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        aria-valuetext={display}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`h-11 w-full accent-foreground disabled:opacity-50 ${focusRing}`}
      />
    </div>
  );
};

export const DelayExporter = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>('horizontal');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [seconds, setSeconds] = useState(DEFAULTS.seconds);
  const [shift, setShift] = useState(DEFAULTS.shift);
  const [count, setCount] = useState(DEFAULTS.count);
  const [exportState, setExportState] = useState<ExportState>({ kind: 'idle' });
  const [canShare, setCanShare] = useState(false);
  // プレビューに補助線を重ねるか。書き出す動画には効かない
  const [guides, setGuides] = useState(true);
  // 調整のシートを開いているか。必要な人だけが開く
  const [adjustOpen, setAdjustOpen] = useState(false);
  const adjustButtonRef = useRef<HTMLButtonElement>(null);
  const closeAdjust = useCallback(() => {
    setAdjustOpen(false);
    // 閉じたら、開いたボタンへフォーカスを戻す。後ろの画面の inert が外れた次のコマで戻す
    requestAnimationFrame(() => adjustButtonRef.current?.focus());
  }, []);

  const running = exportState.kind === 'running';
  const exportedUrl = exportState.kind === 'done' ? exportState.result.url : null;
  const isDefault =
    seconds === DEFAULTS.seconds && shift === DEFAULTS.shift && count === DEFAULTS.count;

  // 書き出した動画の URL は、設定を変えたときと、ページを離れたときに手放す
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
    const frame = { width, height, t: step / STEPS, seam: SEAM, shift, count };
    drawFrame(ctx, source, direction, frame);
    if (guides) drawGuides(ctx, direction, frame);
  }, [picked, direction, step, shift, count, guides]);

  // 書き出した後に写真や設定を変えたら、書き出した動画は今の設定と合わなくなる。書き出す前に戻す
  const edit =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      if (exportState.kind !== 'running') setExportState({ kind: 'idle' });
    };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPickError(null);
    setPlaying(false);
    try {
      edit(setPicked)(await loadImage(file));
      // 選んだらすぐに一度だけ再生し、表現を見せる。動きを減らす設定のときは止めたまま途中の絵を出す
      const reduce = prefersReducedMotion();
      setStep(reduce ? STEPS / 2 : 0);
      setPlaying(!reduce);
    } catch (error) {
      setPickError(error instanceof AspectError ? COPY.aspectError : COPY.readError);
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
      const { blob } = await exportVideo({
        image: picked.source,
        direction,
        settings: { seconds, seam: SEAM, shift, count },
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
      setExportState({ kind: 'done', result: { url: URL.createObjectURL(blob), file } });
    } catch (error) {
      if (controller.signal.aborted) {
        setExportState({ kind: 'idle' });
        return;
      }
      setExportState({
        kind: 'error',
        message: error instanceof UnsupportedError ? COPY.unsupported : COPY.failed,
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

  const reset = () => {
    edit(setSeconds)(DEFAULTS.seconds);
    setShift(DEFAULTS.shift);
    setCount(DEFAULTS.count);
  };

  const disabled = !picked || running;

  const outputActions =
    exportState.kind === 'running' ? (
      <>
        <div
          role="progressbar"
          aria-label={COPY.exporting}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(exportState.done * 100)}
          className="h-1 w-16 overflow-hidden rounded-full bg-foreground/10"
        >
          <div className="h-full bg-foreground" style={{ width: `${exportState.done * 100}%` }} />
        </div>
        <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
          {Math.round(exportState.done * 100)}%
        </span>
        <button
          type="button"
          onClick={() => abortRef.current?.abort()}
          className={`h-11 rounded-full px-4 text-sm active:opacity-70 ${focusRing}`}
        >
          {COPY.cancel}
        </button>
      </>
    ) : exportState.kind === 'done' ? (
      <>
        {canShare && (
          <button
            type="button"
            onClick={() => void share(exportState.result.file)}
            className={`flex h-11 items-center gap-1.5 rounded-full px-3 text-sm active:opacity-70 ${focusRing}`}
          >
            <Export aria-hidden size={18} />
            {COPY.share}
          </button>
        )}
        <a
          href={exportState.result.url}
          download={exportState.result.file.name}
          className={`flex h-11 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm text-background active:opacity-70 ${focusRing}`}
        >
          <DownloadSimple aria-hidden size={18} />
          {COPY.download}
        </a>
      </>
    ) : (
      <button
        type="button"
        disabled={!picked}
        onClick={() => void startExport()}
        className={`h-11 rounded-full bg-foreground px-5 text-sm text-background disabled:opacity-50 active:opacity-70 ${focusRing}`}
      >
        {COPY.export}
      </button>
    );

  // 帯の下に重ねて出す一言。書き出しの結果と、失敗の理由。重ねるので、下の要素の位置をずらさない
  const outputMessage =
    exportState.kind === 'done'
      ? `${COPY.done}（${(exportState.result.file.size / 1_000_000).toFixed(1)} MB）。${COPY.downloadHint}`
      : exportState.kind === 'error'
        ? exportState.message
        : null;

  return (
    <>
      {/* シートを開いている間は、後ろの画面を操作できなくする */}
      <div inert={adjustOpen} className="grid gap-6 pb-16">
        {/* 画面の上に留める帯。左にアプリの名前、右に書き出しの操作だけを置く。書き出しの段階に応じて、同じ場所で中身が入れ替わる */}
        <div className="sticky top-0 z-10 -mx-4 px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex h-14 items-center justify-between gap-3 rounded-full bg-background/70 pr-1.5 pl-5 backdrop-blur-xl">
            {/* アプリの名前。大文字は CSS で見せるだけで、文字は小文字の 2 語のまま（読み上げで 1 文字ずつにならないように）。
                書体と字間は design/foundations.pen の「ラベル、ナビゲーション 0.08–0.1em · uppercase」 */}
            <h1
              className={`${sourceSans.className} truncate text-sm font-normal tracking-[0.1em] uppercase`}
            >
              delay visuals
            </h1>
            <div className="flex shrink-0 items-center gap-2">{outputActions}</div>
          </div>
          {outputMessage && (
            <p
              className={`absolute inset-x-4 top-full mt-2 rounded-2xl bg-background/70 px-4 py-2 text-xs backdrop-blur-xl ${exportState.kind === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
              role={exportState.kind === 'error' ? 'alert' : undefined}
            >
              {outputMessage}
            </p>
          )}
        </div>
        <LabBackLink />
        <p className="text-sm text-muted-foreground">{COPY.tagline}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = '';
          }}
        />

        <section className="grid gap-3" aria-label="プレビュー">
          {/* 写真の有無で高さを変えない。読み込みの後に下の要素の位置をずらさない */}
          <div className="relative grid h-[44svh] place-items-center overflow-hidden rounded-sm bg-foreground/5">
            {picked ? (
              <canvas
                ref={canvasRef}
                width={picked.width}
                height={picked.height}
                // 枠に重ねて置き、枠の大きさの中に写真の全体を収める。grid の行に置くと、縦長の写真では
                // canvas の高さが枠より大きくなり、下が切れる
                className="absolute inset-0 size-full object-contain"
                role="img"
                aria-label={
                  direction === 'horizontal'
                    ? '選んだ写真が右から左へ現れるプレビュー'
                    : '選んだ写真が上から下へ現れるプレビュー'
                }
              />
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={`grid size-full place-content-center justify-items-center gap-3 active:opacity-70 ${focusRing}`}
              >
                <ImageSquare
                  aria-hidden
                  size={40}
                  weight="light"
                  className="text-muted-foreground"
                />
                <span className="text-base">{COPY.choose}</span>
                <span className="text-sm text-muted-foreground">{COPY.chooseHint}</span>
              </button>
            )}
          </div>
          {pickError && (
            <p role="alert" className="text-sm text-destructive">
              {pickError}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={playing ? COPY.pause : COPY.play}
              disabled={disabled}
              onClick={() => {
                if (step >= STEPS) setStep(0);
                setPlaying((value) => !value);
              }}
              className={`grid size-11 shrink-0 place-items-center rounded-full bg-foreground/5 disabled:opacity-50 active:opacity-70 ${focusRing}`}
            >
              {playing ? (
                <Pause aria-hidden size={20} weight="fill" />
              ) : (
                <Play aria-hidden size={20} weight="fill" />
              )}
            </button>
            <input
              type="range"
              aria-label={COPY.position}
              aria-valuetext={`${clock((step / STEPS) * seconds)} / ${clock(seconds)}`}
              min={0}
              max={STEPS}
              value={step}
              disabled={disabled}
              onChange={(event) => {
                setPlaying(false);
                setStep(Number(event.target.value));
              }}
              className={`h-11 min-w-0 flex-1 accent-foreground disabled:opacity-50 ${focusRing}`}
            />
            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
              {clock((step / STEPS) * seconds)} / {clock(seconds)}
            </span>
          </div>
          {picked && (
            <div className="flex items-center justify-between gap-4">
              {/* 入力の写真に効く操作なので、書き出しの操作から離し、プレビューのそばに置く */}
              <button
                type="button"
                disabled={running}
                onClick={() => inputRef.current?.click()}
                className={`h-11 w-fit text-sm underline underline-offset-4 disabled:opacity-50 active:opacity-70 ${focusRing}`}
              >
                {COPY.change}
              </button>
              <label className="flex h-11 cursor-pointer items-center gap-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
                <input
                  type="checkbox"
                  role="switch"
                  checked={guides}
                  onChange={(event) => setGuides(event.target.checked)}
                  className="size-4 accent-foreground outline-none"
                />
                {COPY.guides}
              </label>
            </div>
          )}
        </section>

        <fieldset className="grid gap-3" disabled={running}>
          {/* 文字のラベルを持つセグメントには見出しを出さない（HIG の Segmented controls）。読み上げには残す */}
          <legend className="sr-only">{COPY.direction}</legend>
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
                  onChange={() => edit(setDirection)(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* 向きのほかの設定は、必要な人だけが開く。画面の下から出るシートに置く */}
        <button
          ref={adjustButtonRef}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setAdjustOpen(true)}
          className={`flex h-11 w-fit items-center gap-2 text-sm active:opacity-70 ${focusRing}`}
        >
          <SlidersHorizontal aria-hidden size={18} />
          {COPY.adjust}
        </button>
        <Credit />
      </div>
      <Sheet
        open={adjustOpen}
        title={COPY.adjust}
        closeLabel={COPY.close}
        expandLabel={COPY.expand}
        shrinkLabel={COPY.shrink}
        onClose={closeAdjust}
      >
        <div className="grid gap-5">
          <Slider
            label={COPY.duration}
            value={seconds}
            display={`${seconds} 秒`}
            min={4}
            max={60}
            step={1}
            disabled={running}
            onChange={edit(setSeconds)}
          />
          <Slider
            label={COPY.amount}
            value={shift}
            display={`幅の ${(shift * 100).toFixed(1)}%`}
            min={0}
            max={0.4}
            step={0.001}
            disabled={running}
            onChange={edit(setShift)}
          />
          <Slider
            label={COPY.strips}
            value={count}
            display={`${count} 回`}
            min={1}
            max={60}
            step={1}
            disabled={running}
            onChange={edit(setCount)}
          />
          <button
            type="button"
            disabled={running || isDefault}
            onClick={reset}
            className={`flex h-11 w-fit items-center gap-2 text-sm disabled:opacity-50 active:opacity-70 ${focusRing}`}
          >
            <ArrowCounterClockwise aria-hidden size={16} />
            {COPY.reset}
          </button>
        </div>
      </Sheet>
    </>
  );
};
