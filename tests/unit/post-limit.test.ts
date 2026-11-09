import { describe, expect, it } from 'vitest';
import { PUBLIC_POST_MAX_BYTES, rejectLargePublicPost } from '@/shared/server/post-limit';

/**
 * `/dash` の外への POST の本文の上限の見分け方（src/shared/server/post-limit.ts）。Worker の入口に
 * 組み込んだ振る舞いは tests/integration/action-body-limit.test.ts が持つ
 */

const post = (path: string, length: string | null, method = 'POST') =>
  new Request(`https://synsk.me${path}`, {
    method,
    headers: length === null ? {} : { 'content-length': length },
  });

const statusOf = (request: Request) => rejectLargePublicPost(request)?.status ?? null;

describe('rejectLargePublicPost', () => {
  it('上限ちょうどまでは通し、1 バイト超えると 413', () => {
    expect(statusOf(post('/', String(PUBLIC_POST_MAX_BYTES)))).toBeNull();
    expect(statusOf(post('/', String(PUBLIC_POST_MAX_BYTES + 1)))).toBe(413);
  });

  it('長さを示さない POST は 411、読めない長さは 413', () => {
    expect(statusOf(post('/notes/a', null))).toBe(411);
    expect(statusOf(post('/', '-1'))).toBe(413);
    expect(statusOf(post('/', '1e9'))).toBe(413);
  });

  it.each(['/dash', '/dash/skills/new'])('%s への POST は止めない', (path) => {
    expect(statusOf(post(path, String(PUBLIC_POST_MAX_BYTES * 10)))).toBeNull();
    expect(statusOf(post(path, null))).toBeNull();
  });

  it('/dash で始まるだけの経路は /dash の外として扱う', () => {
    expect(statusOf(post('/dashboard', String(PUBLIC_POST_MAX_BYTES + 1)))).toBe(413);
  });

  it('POST でない要求は止めない', () => {
    expect(statusOf(post('/', null, 'GET'))).toBeNull();
  });
});
