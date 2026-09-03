import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
	// 読み取り専用のキャッシュ。ビルド時に作られたページしか返せず、revalidate は
	// 使えない。全ページが prerendered な間はこれで足りる。
	// 管理画面から記事を書けるようにする時点（ADR-0014）で書き込みできるものが
	// 要る。r2IncrementalCache に差し替え、NEXT_INC_CACHE_R2_BUCKET を
	// wrangler.jsonc に足す。
	// https://opennext.js.org/cloudflare/caching
	incrementalCache: staticAssetsIncrementalCache,
});
