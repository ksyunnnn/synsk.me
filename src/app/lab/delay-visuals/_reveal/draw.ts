// v1 の最終版（catchup。横）と v2（縦）の 1 コマを描く。境目の線は描かない
// canvas の画素の大きさは width × height と同じにする。表示の境目の外は canvas 自身の 1 列（1 行）を引き伸ばすため
// image は描く範囲そのもの。縦横比は width × height と同じにする

// t は再生の進み（0〜1）。seam は内側の境目の位置、shift は帯ごとのずれの最大（動く向きの長さに対する割合）
// shiftBasis はずれの基準の長さ。'axis'（既定）は動く向きの長さ（横は幅、縦は高さ）、'width' は向きによらず幅。
// 'width' にすると、幅に合わせて画面に出したとき、縦横比によらずずれの見え方が同じになる
// backdrop を true にすると、帯を描く前に画像をずらさずに敷く。帯が画像の外を読んだ部分と、帯の境目の
// 半端な画素が透けない。動画は透明を持てないため、書き出すときに使う
export type RevealFrame = {
  width: number;
  height: number;
  t: number;
  seam: number;
  shift: number;
  count: number;
  shiftBasis?: 'axis' | 'width';
  backdrop?: boolean;
};

// 写真を右から左へ出す。内側の境目より右はそのまま、左は帯ごとに右にずれた位置から左へ追いついて揃う
export const drawHorizontal = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  { width, height, t, seam, shift, count, backdrop }: RevealFrame,
) => {
  const scale = image.width / width;
  const seamX = width * seam;
  const revealX = width * (1 - t);

  ctx.clearRect(0, 0, width, height);
  if (backdrop) ctx.drawImage(image, 0, 0, width, height);
  // u は表示の境目がその帯の右端から何帯ぶん進んだか。u = 0 で右に最大ずれ、u = 1 で揃う
  const gap = seamX / count;
  const maxShift = width * shift;
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
      height,
    );
  }
  // 内側の境目より右: そのまま
  ctx.drawImage(
    image,
    seamX * scale,
    0,
    (width - seamX) * scale,
    image.height,
    seamX,
    0,
    width - seamX,
    height,
  );
  // 表示の境目より左: 境目の列を左端まで引き伸ばす
  if (revealX > 0) {
    const column = Math.min(width - 1, Math.floor(revealX));
    ctx.drawImage(ctx.canvas, column, 0, 1, height, 0, 0, column, height);
  }
};

// 写真を上から下へ出す。いちばん上の内側の境目より上はそのまま、下は帯ごとに上にずれた位置から下へ追いついて揃う
export const drawVertical = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  { width, height, t, seam, shift, count, shiftBasis = 'axis', backdrop }: RevealFrame,
) => {
  const scale = image.width / width;
  // いちばん上の内側の境目。seam は横と同じく「動かない側の反対からの割合」
  const seamY = height * (1 - seam);
  const revealY = height * t;
  const gap = (height - seamY) / count;
  const maxShift = (shiftBasis === 'width' ? width : height) * shift;

  ctx.clearRect(0, 0, width, height);
  if (backdrop) ctx.drawImage(image, 0, 0, width, height);
  // いちばん上の境目より上: そのまま
  ctx.drawImage(image, 0, 0, image.width, seamY * scale, 0, 0, width, seamY);
  // その下の帯: u は表示の境目がその帯の上端から何帯ぶん進んだか。u = 0 で上に最大ずれ、u = 1 で揃う
  for (let k = 1; k <= count; k++) {
    const top = seamY + (k - 1) * gap;
    const u = (revealY - top) / gap;
    const offset = u >= 1 ? 0 : maxShift * (1 - Math.max(0, u));
    ctx.drawImage(image, 0, (top + offset) * scale, image.width, gap * scale, 0, top, width, gap);
  }
  // 表示の境目より下: 境目の行を下端まで引き伸ばす
  if (revealY < height) {
    const row = Math.max(0, Math.floor(revealY));
    ctx.drawImage(ctx.canvas, 0, row, width, 1, 0, row, width, height - row);
  }
};
