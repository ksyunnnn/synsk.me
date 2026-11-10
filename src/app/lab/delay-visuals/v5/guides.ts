// プレビューにだけ重ねる補助線。v1 と v2 の境目の線と同じ意味を持つ
//   表示の境目（v1 と v2 の赤）: 写真がいま現れている端。実線
//   内側の境目（v1 と v2 の青）: ストライプの境目。いちばん端の線より先はそのまま現れる。点線
// 書き出す動画には描かない。encode.ts はこのファイルを読み込まない
import type { Direction } from './encode';

type Frame = { width: number; height: number; t: number; seam: number; count: number };

// 色はトークン（src/app/globals.css）から取る。値は「0 0% 89.8%」のような hsl の中身
const token = (name: string) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return `hsl(${value})`;
};

export const drawGuides = (
  ctx: CanvasRenderingContext2D,
  direction: Direction,
  { width, height, t, seam, count }: Frame,
) => {
  // canvas は書き出す画素数で、画面では縮めて出す。線の太さと点線の間隔を、画面での大きさにそろえる
  const ratio = ctx.canvas.clientWidth > 0 ? width / ctx.canvas.clientWidth : 1;
  const horizontal = direction === 'horizontal';
  const length = horizontal ? width : height;
  // いちばん端の内側の境目。横は左から、縦は上からの位置
  const seamAt = horizontal ? length * seam : length * (1 - seam);
  const gap = (horizontal ? seamAt : length - seamAt) / count;
  const seams = Array.from({ length: count }, (_, index) =>
    horizontal ? seamAt - index * gap : seamAt + index * gap,
  );
  // 端に来たときも見えるように、線を canvas の内側に収める
  const reveal = Math.min(
    length - ratio,
    Math.max(ratio, horizontal ? length * (1 - t) : length * t),
  );

  const line = (at: number) => {
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(at, 0);
      ctx.lineTo(at, height);
    } else {
      ctx.moveTo(0, at);
      ctx.lineTo(width, at);
    }
    ctx.stroke();
  };
  // 色は無彩色のトークンだけを使う（design/foundations.pen の Color「無彩色のグレーだけで構造を作る」）。
  // 線の色は境界線の役割を持つ border。明るい写真の上でも見えるよう、foreground の細い縁を両側に付ける。
  // 明るい border と暗い foreground の組なら、写真のどの色の上でもどちらかが 3:1 以上の対比になる
  // 2 種類の線は色でなく、線の形で見分ける。表示の境目は実線、ストライプの境目は点線
  const stroke = (positions: number[], width: number, dash: number[]) => {
    ctx.setLineDash(dash.map((value) => value * ratio));
    ctx.lineWidth = (width + 2) * ratio;
    ctx.strokeStyle = token('--foreground');
    positions.forEach(line);
    ctx.lineWidth = width * ratio;
    ctx.strokeStyle = token('--border');
    positions.forEach(line);
  };

  ctx.save();
  stroke(seams, 1, [4, 4]);
  stroke([reveal], 1.5, []);
  ctx.restore();
};
