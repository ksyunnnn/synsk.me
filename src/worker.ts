import handler from 'vinext/server/fetch-handler';
import { isPreviewRequest, withNoStore } from '@/lib/preview-no-store';

/**
 * Worker の入口。vinext の fetch ハンドラに任せ、プレビュー配信の応答だけを
 * どのキャッシュにも残さない形にする（src/lib/preview-no-store.ts）。
 *
 * vinext は、自前の入口から fetch ハンドラを呼ぶ形を示す
 * （`vinext/dist/server/fetch-handler.js` の注記）。
 */
const worker = {
  ...handler,
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const response = await handler.fetch(request, env, ctx);
    return isPreviewRequest(request.url) ? withNoStore(response) : response;
  },
};

export default worker;
