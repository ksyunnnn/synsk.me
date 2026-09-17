import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { verifyAuthor, type AccessSettings } from '@/features/note/server/author';
import {
  ACCESS_CERTS_PATH,
  TEST_ACCESS_AUD,
  TEST_OWNER_EMAIL,
  createAccessTestKeys,
  signAccessJwt,
  startAccessCertsServer,
  type AccessCertsServer,
  type AccessTestKeys,
} from '../support/access';

/**
 * Cloudflare Access の JWT を検証し、作り手であることを確かめる関数
 * （docs/decisions/0036-verify-access-jwt-in-app.md）。
 *
 * 公開鍵は、テストが起動する手元のサーバから取る。
 */

let keys: AccessTestKeys;
let certs: AccessCertsServer;
let settings: AccessSettings;

beforeAll(async () => {
  keys = await createAccessTestKeys();
  certs = await startAccessCertsServer(keys.publicJwk);
  settings = {
    certsUrl: `${certs.issuer}${ACCESS_CERTS_PATH}`,
    issuer: certs.issuer,
    audience: TEST_ACCESS_AUD,
    ownerEmail: TEST_OWNER_EMAIL,
  };
});

afterAll(async () => {
  await certs?.close();
});

const sign = (overrides: { audience?: string; email?: string; expiresAt?: number } = {}) =>
  signAccessJwt(keys.privateJwk, { issuer: certs.issuer, ...overrides });

describe('作り手であることを確かめる', () => {
  it('オーナーの正しい JWT は作り手として通る', async () => {
    expect(await verifyAuthor(await sign(), settings)).toEqual({ email: TEST_OWNER_EMAIL });
  });

  describe('AUD タグをカンマで区切って複数持つ', () => {
    // 本番の `/dash` とプレビュー全体の2つの Access のアプリケーションは、別の AUD タグを
    // 持つ。どちらの JWT も通す（specs/005-note-write-and-read/research.md の R2）
    const audience = `production-aud, ${TEST_ACCESS_AUD}`;

    it.each(['production-aud', TEST_ACCESS_AUD])('%s の JWT は作り手として通る', async (aud) => {
      expect(await verifyAuthor(await sign({ audience: aud }), { ...settings, audience })).toEqual({
        email: TEST_OWNER_EMAIL,
      });
    });

    it('どれにも一致しない JWT は拒む', async () => {
      expect(
        await verifyAuthor(await sign({ audience: 'other-aud' }), { ...settings, audience }),
      ).toBeNull();
    });

    it('区切りだけで AUD タグがなければ拒む', async () => {
      expect(await verifyAuthor(await sign(), { ...settings, audience: ' , ' })).toBeNull();
    });
  });

  describe('JWT を拒む', () => {
    it.each([
      ['ヘッダがない', null],
      ['空', ''],
      ['JWT の形でない', 'not-a-jwt'],
    ])('%s', async (_, token) => {
      expect(await verifyAuthor(token, settings)).toBeNull();
    });

    it('別の鍵で署名されている', async () => {
      // kid は同じで、鍵だけが違う
      const other = await createAccessTestKeys();
      const token = await signAccessJwt(other.privateJwk, { issuer: certs.issuer });
      expect(await verifyAuthor(token, settings)).toBeNull();
    });

    it('発行元が違う', async () => {
      const token = await signAccessJwt(keys.privateJwk, {
        issuer: 'https://other.cloudflareaccess.com',
      });
      expect(await verifyAuthor(token, settings)).toBeNull();
    });

    it('aud が違う', async () => {
      expect(await verifyAuthor(await sign({ audience: 'other-aud' }), settings)).toBeNull();
    });

    it('期限が切れている', async () => {
      const expiresAt = Math.floor(Date.now() / 1000) - 60;
      expect(await verifyAuthor(await sign({ expiresAt }), settings)).toBeNull();
    });

    it('メールアドレスがオーナーのものでない', async () => {
      expect(await verifyAuthor(await sign({ email: 'visitor@synsk.test' }), settings)).toBeNull();
    });
  });

  describe('設定値が欠けていれば拒む', () => {
    it.each(['certsUrl', 'issuer', 'audience', 'ownerEmail'] as const)(
      '%s がない',
      async (name) => {
        const token = await sign();
        expect(await verifyAuthor(token, { ...settings, [name]: undefined })).toBeNull();
        expect(await verifyAuthor(token, { ...settings, [name]: '' })).toBeNull();
      },
    );
  });

  it('公開鍵が取れなければ拒む', async () => {
    // 起動してすぐ閉じたサーバのポートには、何も応答しない
    const closed = await startAccessCertsServer(keys.publicJwk);
    await closed.close();
    const token = await sign();
    expect(
      await verifyAuthor(token, { ...settings, certsUrl: `${closed.issuer}${ACCESS_CERTS_PATH}` }),
    ).toBeNull();
  });
});
