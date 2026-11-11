import type { VersionMeta } from '../../_lab/registry';

export const meta: VersionMeta = {
  summary:
    '自分の画像に v1 の最終版（横）か v2（縦）の表現をかけ、MP4 の動画に書き出してダウンロードする。WebCodecs の VideoEncoder で H.264 に符号化し、mediabunny で MP4 に詰める。1 コマずつ t から描くので、再生の長さより早く書き出せる。/delay-visuals でも開ける',
};
