import handler from 'vinext/server/fetch-handler';
import { rejectLargePublicPost } from '@/shared/server/post-limit';
import { isPreviewRequest, withNoStore } from '@/shared/server/preview-no-store';
import { runScheduled } from './scheduled';

/**
 * Worker の入口。vinext の fetch ハンドラに任せ、プレビュー配信の応答だけを
 * どのキャッシュにも残さない形にする（src/shared/server/preview-no-store.ts）。
 * `/dash` の外への大きい POST は、vinext に渡す前に拒む（src/shared/server/post-limit.ts）。
 * 定期実行（Cron Triggers）は worker/scheduled.ts に任せる。
 *
 * vinext は、自前の入口から fetch ハンドラを呼ぶ形を示す
 * （`vinext/dist/server/fetch-handler.js` の注記）。
 */
const worker = {
  ...handler,
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const rejected = rejectLargePublicPost(request);
    // 拒んだ要求の本文は読まずに捨てる。読み残すと、手元の workerd が接続を切ることがある
    if (rejected) await request.body?.cancel();
    const response = rejected ?? (await handler.fetch(request, env, ctx));
    return isPreviewRequest(request.url) ? withNoStore(response) : response;
  },
  async scheduled(controller: ScheduledController) {
    await runScheduled(controller.scheduledTime);
  },
};

export default worker;
