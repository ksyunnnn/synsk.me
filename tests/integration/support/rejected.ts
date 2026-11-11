import { expect } from 'vitest';
import type { TestServer } from './d1';

/**
 * 送った本文が拒まれたか。Worker の入口（`src/shared/server/post-limit.ts`）と vinext
 * （`app-server-action-execution.js`）は、`Content-Length` だけを見て 413 を返し、本文を読まない。
 * 読まれない本文を検査がまだ書いている間に、workerd か検査の道具の側が接続を閉じると、次のどれかに
 * なる（2026-11-09 に、12 MB を 30 回送って、413 のほかに 2 と 3 が起きることを確かめた）。`send` は
 * POST だけを送る関数にする。前段の GET の失敗を拒みと取り違えないため
 * 1. 413 の応答
 * 2. `fetch` が投げる（undici の `TypeError` で、文言は `terminated` か `fetch failed`。2026-11-09 に
 *    両方を見た）
 * 3. 検査の道具（wrangler の `createTestHarness`）が、送り先の接続が切れたことを 500 と
 *    `Network connection lost.` で返す
 * どれも、Worker が本文を受け取らずに拒んだことを表す。製品の 500 と見分けるため、3 は本文の
 * 文言で確かめる
 */
type Sent = Awaited<ReturnType<TestServer['server']['fetch']>>;

export const expectRejected = async (send: () => Promise<Sent>) => {
  let response: Sent;
  try {
    response = await send();
  } catch (error) {
    // 検査の書き誤りの TypeError（undefined の読み出しなど）を拒みと取り違えないよう、文言で絞る
    expect(error).toBeInstanceOf(TypeError);
    expect(['terminated', 'fetch failed']).toContain((error as TypeError).message);
    return;
  }
  if (response.status === 500) {
    expect(await response.text()).toContain('Network connection lost.');
    return;
  }
  expect(response.status).toBe(413);
  await response.body?.cancel();
};
