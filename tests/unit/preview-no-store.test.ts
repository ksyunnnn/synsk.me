import { describe, expect, it } from 'vitest';
import { isPreviewRequest, withNoStore } from '@/shared/server/preview-no-store';

describe('isPreviewRequest', () => {
  it.each([
    'https://feature-x-synsk-me.is-syunsukekobashi.workers.dev/',
    'https://0123abcd-synsk-me.is-syunsukekobashi.workers.dev/dash',
  ])('%s はプレビュー', (url) => {
    expect(isPreviewRequest(url)).toBe(true);
  });

  it.each(['https://synsk.me/', 'http://127.0.0.1:8788/', 'https://workers.dev.example.com/'])(
    '%s はプレビューでない',
    (url) => {
      expect(isPreviewRequest(url)).toBe(false);
    },
  );
});

describe('withNoStore', () => {
  it('キャッシュしてよい応答を、どのキャッシュにも残さない形にする', async () => {
    const response = new Response('本文', {
      status: 201,
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'public, max-age=3600',
        'Cloudflare-CDN-Cache-Control': 'max-age=60',
        'Content-Type': 'text/html',
      },
    });

    const result = withNoStore(response);

    expect(result.status).toBe(201);
    expect(await result.text()).toBe('本文');
    expect(result.headers.get('cache-control')).toBe('no-store, must-revalidate');
    expect(result.headers.get('cdn-cache-control')).toBeNull();
    expect(result.headers.get('cloudflare-cdn-cache-control')).toBeNull();
    expect(result.headers.get('content-type')).toBe('text/html');
  });

  it('ヘッダを変えられない応答も書き換えられる', () => {
    const immutable = Response.redirect('https://synsk.me/', 302);
    expect(withNoStore(immutable).headers.get('cache-control')).toBe('no-store, must-revalidate');
  });
});
