/**
 * `react-server-dom-webpack` は型を同梱しない。`form.ts` が使う関数だけを宣言する。
 * 戻り値は React の `encodeReply` の定義による
 * （`node_modules/@vitejs/plugin-rsc/dist/client-Bhch3O41.d.ts` の `EncodeReplyFunction`）
 */
declare module 'react-server-dom-webpack/client.edge' {
  export function encodeReply(value: unknown[]): Promise<string | FormData>;
}
