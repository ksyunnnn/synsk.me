'use client';

/**
 * ページの描画中に投げられた例外（D1 から読み出せないなど）のときの表示。
 *
 * vinext 1.0.0-beta.9 は、`global-error.tsx` で描画した応答を 500 にし、`error.tsx` で
 * 描画した応答を 200 にする（`vinext/dist/server/app-page-boundary-render.js` の
 * `renderAppPageErrorBoundary`）。読み出せなかったことを状態コードでも伝えるため、
 * `error.tsx` を置かず、ここで受ける。
 *
 * 例外の中身を表示しない。note の題や本文を含みうるため。
 */
const GlobalError = () => (
  <html lang="ja">
    <body>
      <main>
        <h1>ページを読み出せませんでした</h1>
        <p>時間をおいて、開き直してください。</p>
      </main>
    </body>
  </html>
);

export default GlobalError;
