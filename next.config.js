/** Workers Builds のブランチ コントロールで指定しているプロダクション ブランチ */
const PRODUCTION_BRANCH = 'main';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // キャッシュは `'use cache'` で、キャッシュするものを選んで作る
  // （https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents）
  cacheComponents: true,

  experimental: {
    // note の画像の追加は Server Action で送る。1 枚 5 MB を上限にする（specs/003-note/research.md
    // の R7）ため、フォームの残りの値を足しても収まる大きさにする。vinext の既定は 1 MB
    serverActions: { bodySizeLimit: '6mb' },
  },

  env: {
    // WORKERS_CI_BRANCH は Cloudflare Workers Builds がビルド時に渡すブランチ名。
    // 手元のビルドでは未定義になり、preview に落ちる。
    NEXT_PUBLIC_DEPLOY_ENV:
      process.env.WORKERS_CI_BRANCH === PRODUCTION_BRANCH ? 'production' : 'preview',
  },
};

export default nextConfig;
