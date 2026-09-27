import { describe, expect, it } from 'vitest';

import {
  absentNotePath,
  accessHeadersFor,
  bypassCacheUrl,
  extractChunkPaths,
  isAccessLoginRedirect,
  isProductionBase,
  isPng,
} from '../../scripts/lib/verify-deploy.mjs';

const PREVIEW = 'https://ea015945-synsk-me.is-syunsukekobashi.workers.dev';

/**
 * `scripts/verify-deploy.mjs` が判定に使う材料を検査する。
 *
 * 検査の本体はデプロイ後の本番に触れるため、ここでは扱えない。抽出と判定の
 * 部分だけを固定する。#71 の原因は、キャッシュ済みの HTML から抽出した
 * チャンクを配信中の版に求めたことだった。
 */

describe('extractChunkPaths', () => {
  it('src と href の両方から拾い、重複を除く', () => {
    const html = `
      <link rel="modulepreload" href="/_next/static/chunks/index-abc123.js"/>
      <script src="/_next/static/chunks/index-abc123.js"></script>
      <script src="/_next/static/chunks/vinext-def456.js"></script>
    `;
    expect(extractChunkPaths(html)).toEqual([
      '/_next/static/chunks/index-abc123.js',
      '/_next/static/chunks/vinext-def456.js',
    ]);
  });

  it('`_next/static` の外の JS は拾わない', () => {
    const html = `
      <script src="https://kit.fontawesome.com/fa9c201f80.js"></script>
      <script src="/other/app.js"></script>
      <script src="/_next/static/chunks/index-abc123.js"></script>
    `;
    expect(extractChunkPaths(html)).toEqual(['/_next/static/chunks/index-abc123.js']);
  });

  it('参照がなければ空を返す', () => {
    expect(extractChunkPaths('<html><body>工事中</body></html>')).toEqual([]);
  });
});

describe('isPng', () => {
  it('先頭 8 バイトが PNG の署名なら true', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(isPng(bytes)).toBe(true);
  });

  it('署名が違えば false', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    expect(isPng(bytes)).toBe(false);
  });

  it('署名より短ければ false。200 でも中身が空という出方をするため', () => {
    expect(isPng(new Uint8Array([0x89, 0x50]))).toBe(false);
    expect(isPng(new Uint8Array([]))).toBe(false);
  });
});

describe('bypassCacheUrl', () => {
  it('エッジのキャッシュを迂回するクエリを足す', () => {
    expect(bypassCacheUrl('https://synsk.me', '/', '1788800000000')).toBe(
      'https://synsk.me/?__verify=1788800000000',
    );
  });

  it('経路を保つ', () => {
    expect(bypassCacheUrl('https://synsk.me', '/archives/2024', 'x')).toBe(
      'https://synsk.me/archives/2024?__verify=x',
    );
  });

  it('プレビュー配信の URL でも同じ形になる', () => {
    expect(
      bypassCacheUrl('https://ea015945-synsk-me.is-syunsukekobashi.workers.dev', '/', 'x'),
    ).toBe('https://ea015945-synsk-me.is-syunsukekobashi.workers.dev/?__verify=x');
  });
});

describe('isProductionBase', () => {
  it('synsk.me なら true', () => {
    expect(isProductionBase('https://synsk.me')).toBe(true);
  });

  it('プレビュー配信の URL なら false', () => {
    expect(isProductionBase(PREVIEW)).toBe(false);
  });

  it('synsk.me を含むだけのホストは false', () => {
    expect(isProductionBase('https://synsk.me.example.com')).toBe(false);
  });
});

describe('accessHeadersFor', () => {
  const token = {
    CLOUDFLARE_ACCESS_CLIENT_ID: 'id.access',
    CLOUDFLARE_ACCESS_CLIENT_SECRET: 'secret',
  };

  it('本番には service token を付けない。本番の Access は /dash だけを守るため', () => {
    expect(accessHeadersFor('https://synsk.me', token)).toEqual({ ok: true, headers: {} });
  });

  it('プレビュー配信には service token をヘッダに付ける', () => {
    expect(accessHeadersFor(PREVIEW, token)).toEqual({
      ok: true,
      headers: { 'CF-Access-Client-Id': 'id.access', 'CF-Access-Client-Secret': 'secret' },
    });
  });

  it('プレビュー配信で service token が欠けていれば、欠けた変数の名前を返す', () => {
    expect(accessHeadersFor(PREVIEW, {})).toEqual({
      ok: false,
      missing: ['CLOUDFLARE_ACCESS_CLIENT_ID', 'CLOUDFLARE_ACCESS_CLIENT_SECRET'],
    });
    expect(accessHeadersFor(PREVIEW, { CLOUDFLARE_ACCESS_CLIENT_ID: 'id.access' })).toEqual({
      ok: false,
      missing: ['CLOUDFLARE_ACCESS_CLIENT_SECRET'],
    });
  });

  it('空の値は欠けているとみなす', () => {
    expect(
      accessHeadersFor(PREVIEW, {
        CLOUDFLARE_ACCESS_CLIENT_ID: '',
        CLOUDFLARE_ACCESS_CLIENT_SECRET: 'secret',
      }),
    ).toEqual({ ok: false, missing: ['CLOUDFLARE_ACCESS_CLIENT_ID'] });
  });
});

describe('isAccessLoginRedirect', () => {
  const login =
    'https://example.cloudflareaccess.com/cdn-cgi/access/login/synsk.me?redirect_url=%2Fdash';

  it('Access の team domain へ移す応答なら true', () => {
    expect(isAccessLoginRedirect(302, login, 'https://synsk.me')).toBe(true);
  });

  it('移さない応答は false。Worker が 403 や 200 を返したとき', () => {
    expect(isAccessLoginRedirect(403, null, 'https://synsk.me')).toBe(false);
    expect(isAccessLoginRedirect(200, login, 'https://synsk.me')).toBe(false);
  });

  it('移し先がないか、Access の外なら false', () => {
    expect(isAccessLoginRedirect(302, null, 'https://synsk.me')).toBe(false);
    expect(isAccessLoginRedirect(302, '/login', 'https://synsk.me')).toBe(false);
    expect(isAccessLoginRedirect(302, 'https://synsk.me/', 'https://synsk.me')).toBe(false);
  });

  it('cloudflareaccess.com を含むだけのホストは false', () => {
    expect(
      isAccessLoginRedirect(
        302,
        'https://example.cloudflareaccess.com.evil.example/login',
        'https://synsk.me',
      ),
    ).toBe(false);
    expect(isAccessLoginRedirect(302, 'https://cloudflareaccess.com/', 'https://synsk.me')).toBe(
      false,
    );
  });

  it('解釈できない移し先は false', () => {
    expect(isAccessLoginRedirect(302, 'http://[', 'https://synsk.me')).toBe(false);
  });
});

describe('absentNotePath', () => {
  it('note の経路の下に、nonce を含む slug を作る', () => {
    expect(absentNotePath('1788800000000-abc')).toBe(
      '/notes/verify-deploy-absent-1788800000000-abc',
    );
  });

  it('slug に使えない文字を除く。作り手が作りうる slug の形で確かめるため', () => {
    const path = absentNotePath('1788800000000-A.b_c');
    expect(path).toBe('/notes/verify-deploy-absent-1788800000000-bc');
    expect(path.slice('/notes/'.length)).toMatch(/^[a-z0-9-]+$/);
  });
});
