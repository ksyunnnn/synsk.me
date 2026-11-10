// 1 コマずつ t から描いて H.264 の MP4 に書き出す。実時間で録らないので、コマを落とさず、再生の長さより早く終わる
// 符号化は WebCodecs の VideoEncoder（Safari は 16.4 から。https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder）、
// MP4 への詰め込みは mediabunny（https://mediabunny.dev/guide/writing-media-files）が行う
import { drawHorizontal, drawVertical, type RevealFrame } from '../_reveal/draw';

export type Direction = 'horizontal' | 'vertical';

export type RevealSettings = { seconds: number; seam: number; shift: number; count: number };

export const FPS = 30;
// Instagram のストーリーの動画は横 1920 画素まで、ビットレート 25Mbps まで、100MB まで
// （https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media の Story Video Specifications）
const MAX_LONG_SIDE = 1920;
// 60 秒で約 60MB になる
const BITRATE = 8_000_000;
// H.264 のレベル 4.0 で 1 コマに収まるマクロブロック（16×16 画素）の数。1920×1080 がちょうど収まる
const MAX_MACROBLOCKS = 8192;
// 先に試す順。Main と High は Safari 27.2 より前で出力が止まることがある
// （https://webkit.org/blog/18515/webkit-features-for-safari-27-2/）ため、Baseline を先にする。末尾の 28 はレベル 4.0
const CODECS = ['avc1.420028', 'avc1.4d0028', 'avc1.640028'];

export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  direction: Direction,
  frame: RevealFrame,
) =>
  (direction === 'horizontal' ? drawHorizontal : drawVertical)(ctx, image, {
    ...frame,
    // ずれは向きによらず幅を基準にする。ストーリーのように幅に合わせて出したとき、縦横比によらず同じに見える
    shiftBasis: 'width',
    backdrop: true,
  });

// Instagram のストーリーの動画の縦横比は 0.1:1 から 10:1 まで（上の Story Video Specifications）
export const isAcceptedAspect = (imageWidth: number, imageHeight: number) => {
  const aspect = imageWidth / imageHeight;
  return aspect >= 0.1 && aspect <= 10;
};

// 画像の縦横比を保ったまま、長い辺を 1920 画素まで、マクロブロックをレベル 4.0 の上限まで縮める。辺は符号化のために偶数にする
export const outputSize = (imageWidth: number, imageHeight: number) => {
  let scale = Math.min(1, MAX_LONG_SIDE / Math.max(imageWidth, imageHeight));
  for (;;) {
    const width = Math.max(2, Math.round((imageWidth * scale) / 2) * 2);
    const height = Math.max(2, Math.round((imageHeight * scale) / 2) * 2);
    if (Math.ceil(width / 16) * Math.ceil(height / 16) <= MAX_MACROBLOCKS) return { width, height };
    scale *= 0.99;
  }
};

const findCodec = async (width: number, height: number) => {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of CODECS) {
    const { supported } = await VideoEncoder.isConfigSupported({
      codec,
      width,
      height,
      bitrate: BITRATE,
      framerate: FPS,
    });
    if (supported) return codec;
  }
  return null;
};

export class UnsupportedError extends Error {}

export const exportVideo = async ({
  image,
  direction,
  settings: { seconds, seam, shift, count },
  onProgress,
  signal,
}: {
  // 書き出す大きさに縮めた画像。動画の大きさはこの画像の大きさになる
  image: HTMLCanvasElement;
  direction: Direction;
  settings: RevealSettings;
  onProgress: (done: number) => void;
  signal: AbortSignal;
}) => {
  const { width, height } = image;
  const codec = await findCodec(width, height);
  if (!codec) throw new UnsupportedError();
  // 書き出すときだけ読み込む。ページを開いただけでは取りに行かない
  const { BufferTarget, CanvasSource, Mp4OutputFormat, Output } = await import('mediabunny');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new UnsupportedError();

  const output = new Output({
    // moov を先頭に置く。Instagram のストーリーの動画の条件（上の Story Video Specifications）
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, {
    codec: 'avc',
    fullCodecString: codec,
    bitrate: BITRATE,
  });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  const frames = Math.max(2, Math.round(seconds * FPS));
  try {
    for (let i = 0; i < frames; i++) {
      signal.throwIfAborted();
      // 最後のコマで出し終える
      const t = i / (frames - 1);
      drawFrame(ctx, image, direction, { width, height, t, seam, shift, count });
      await source.add(i / FPS, 1 / FPS);
      onProgress((i + 1) / frames);
    }
    await output.finalize();
    // 仕上げの間にやめたときも、動画を返さない
    signal.throwIfAborted();
  } catch (error) {
    await output.cancel();
    throw error;
  }
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('書き出した動画が空だった');
  return { blob: new Blob([buffer], { type: 'video/mp4' }), width, height, codec };
};
