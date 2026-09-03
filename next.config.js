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
};

export default nextConfig;
