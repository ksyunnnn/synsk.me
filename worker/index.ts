import handler from 'vinext/server/fetch-handler';
import { handleScheduled } from '@/features/activity/server/scheduled';
import type { Env } from '@/shared/server/env';
import { isPreviewRequest, withNoStore } from '@/shared/server/preview-no-store';

/**
 * Worker の入口。vinext の fetch ハンドラに任せ、プレビュー配信の応答だけを
 * どのキャッシュにも残さない形にする（src/shared/server/preview-no-store.ts）。
 * Cron Triggers（wrangler.jsonc の `triggers.crons`）が呼ぶ `scheduled()` は、外部の activity
 * を取得する（specs/004-external-activity/research.md の R6）。
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
  async scheduled(controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(controller.scheduledTime, env as Env));
  },
};

export default worker;
