import type { VersionMeta } from '../../_lab/registry';

export const meta: VersionMeta = {
  summary:
    'v3.2 の表現をスクロールに合わせて動かした。表示の境目を画面の上から決まった高さに置き、scroll イベントで測った位置から帯のずれと縞を描く。縞は画面の下端までだけ引き伸ばす',
};
