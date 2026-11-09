import { describe, expect, it } from 'vitest';
import { LIST_SOURCES } from '@/features/activity/domain/sources';
import { createSourceRegistry } from '@/features/activity/server/sources/registry';
import { createFakeFetcher, jsonResponse } from '../support/activity-fakes';

/**
 * 取得元の名前から取得元ごとの処理を引く表（T017、research.md の R3・R15）。外へ要求を出さない
 */

const LIMITS = { maxRequests: 1, timeoutMs: 1000, maxBytes: 100_000 };

describe('createSourceRegistry', () => {
  it('一覧を取る取得元のうち、GitHub を除くすべてに処理がある', async () => {
    const { fetcher } = createFakeFetcher({});
    const registry = createSourceRegistry(fetcher, {});

    expect(LIST_SOURCES.filter((source) => !registry.hasListing(source))).toEqual(['github']);
    await expect(registry.fetchListing('github', LIMITS)).rejects.toThrow(/GitHub/);
  });

  it('Qiita にはアクセストークンを、connpass には API キーを渡す（R15）', async () => {
    const { fetcher, requested } = createFakeFetcher({
      'https://qiita.com/api/v2/users/ksyunnnn/items?page=1&per_page=20': jsonResponse([], {
        'Total-Count': '0',
      }),
    });
    const registry = createSourceRegistry(fetcher, { QIITA_ACCESS_TOKEN: 'fake-token' });

    await registry.fetchListing('qiita', LIMITS);
    await expect(registry.fetchListing('connpass', LIMITS)).rejects.toThrow(/CONNPASS_API_KEY/);

    expect(requested[0]?.headers.get('Authorization')).toBe('Bearer fake-token');
  });

  it('消えたかを確かめる手段は Zenn と Speaker Deck だけが持つ（R6）', async () => {
    const { fetcher } = createFakeFetcher({});
    const registry = createSourceRegistry(fetcher, {});

    expect(await registry.goneCheckOf('zenn')?.('https://zenn.dev/fake', LIMITS)).toBe('gone');
    expect(
      await registry.goneCheckOf('speakerdeck')?.('https://speakerdeck.com/fake', LIMITS),
    ).toBe('gone');
    // 手段を持たない取得元には関数が無く、取得のユースケースは確かめない
    expect(registry.goneCheckOf('medium')).toBeUndefined();
    expect(registry.goneCheckOf('qiita')).toBeUndefined();
  });
});
