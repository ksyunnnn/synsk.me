import type { VersionMeta } from '../../_lab/registry';

export const meta: VersionMeta = {
  summary:
    'v4 の表現で、表示の境目の高さをスクロールに合わせて変えた。最初の 1 画面ぶんのスクロールで、画面の上から 30% から 64% へ動く。window.scrollY を画面の高さで割った割合で 2 つの高さの間をとる',
};
