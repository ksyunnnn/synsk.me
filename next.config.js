/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig

import('@opennextjs/cloudflare')
  .then((m) => m.initOpenNextCloudflareForDev())
  .catch((e) => console.error('initOpenNextCloudflareForDev failed:', e));
