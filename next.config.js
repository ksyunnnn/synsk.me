/** Workers Builds のブランチ コントロールで指定しているプロダクション ブランチ */
const PRODUCTION_BRANCH = 'main';

/** 正規の origin（ADR-0021）。カードの画像などの絶対 URL を作る `metadataBase` に使う */
const CANONICAL_ORIGIN = 'https://synsk.me';

/**
 * ページの絶対 URL の origin。Workers Builds のビルド（本番と Preview）は正規の origin にする。
 * Preview の URL は、ビルドに渡る値から公式の規則で作れないため、Preview も本番の origin を指す。
 * 手元のビルドは SITE_ORIGIN を渡すとその値にし、渡さなければ正規の origin にする。要求の Host は
 * 使わない。layout で要求を読むと、すべての経路がキャッシュに載らなくなる（ADR-0040）
 */
const siteOrigin = () => {
  const origin = process.env.WORKERS_CI
    ? CANONICAL_ORIGIN
    : (process.env.SITE_ORIGIN ?? CANONICAL_ORIGIN);
  const url = new URL(origin);
  if (url.origin !== origin)
    throw new Error(`SITE_ORIGIN は origin だけを書く（例: ${CANONICAL_ORIGIN}）: ${origin}`);
  return origin;
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  // キャッシュは `'use cache'` で、キャッシュするものを選んで作る
  // （https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents）
  cacheComponents: true,

  env: {
    // WORKERS_CI_BRANCH は Cloudflare Workers Builds がビルド時に渡すブランチ名。
    // 手元のビルドでは未定義になり、preview に落ちる。
    NEXT_PUBLIC_DEPLOY_ENV:
      process.env.WORKERS_CI_BRANCH === PRODUCTION_BRANCH ? 'production' : 'preview',
    SITE_ORIGIN: siteOrigin(),
  },
};

export default nextConfig;
