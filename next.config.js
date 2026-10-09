/** Workers Builds のブランチ コントロールで指定しているプロダクション ブランチ */
const PRODUCTION_BRANCH = 'main';

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // WORKERS_CI_BRANCH は Cloudflare Workers Builds がビルド時に渡すブランチ名。
    // 手元のビルドでは未定義になり、preview に落ちる。
    NEXT_PUBLIC_DEPLOY_ENV:
      process.env.WORKERS_CI_BRANCH === PRODUCTION_BRANCH ? 'production' : 'preview',
  },

  async rewrites() {
    return {
      // 経路を変えない rewrite。`/dash` 配下を、`npm run deploy` がデプロイの前に
      // 本番へ要求を送るキャッシュ判定の対象から外すために置く。
      //
      // `/dash` は Cloudflare Access の後ろにあり、判定の要求に 2xx を返さない。
      // 2xx でない経路が 1 つでもあるとデプロイ全体が止まる
      // （`@vinext/cloudflare/dist/cacheability-probe.js`）。rewrites の source に
      // 当たる経路は判定の対象から外れ、実行時に `no-store` になる
      // （`vinext/dist/build/prerender-paths.js` の `configuredRouteAffectsWarmPath`）。
      // この除外は vinext の内部の挙動で、公式の文書にない。
      // 根拠は specs/005-note-write-and-read/research.md の R7 にある。
      fallback: [{ source: '/dash/:path*', destination: '/dash/:path*' }],
    };
  },
};

export default nextConfig;
