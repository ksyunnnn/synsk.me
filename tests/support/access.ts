import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SignJWT, exportJWK, generateKeyPair, importJWK, type JWK } from 'jose';

/**
 * Cloudflare Access の代わりに、テストが作り手の JWT を作るための道具。
 * 結合テストと E2E が使う。
 *
 * 本番のコードに試験用の分岐を持たせない。設定値 `ACCESS_ISSUER` を、ここで
 * 起動する公開鍵のサーバへ向ける（specs/005-note-write-and-read/research.md の R6）。
 */

/** テストで使う Access のアプリケーションの AUD タグ */
export const TEST_ACCESS_AUD = 'synsk-me-test-aud';
/** テストで作り手として認めるメールアドレス */
export const TEST_OWNER_EMAIL = 'owner@synsk.test';

/** Access が公開鍵を配る経路 */
export const ACCESS_CERTS_PATH = '/cdn-cgi/access/certs';

/**
 * テスト用の鍵の組。プロセスをまたいで渡せるように、どちらも JWK（JSON）で持つ。
 * テストのたびに作り、リポジトリに置かない
 */
export type AccessTestKeys = { privateJwk: JWK; publicJwk: JWK };

export const createAccessTestKeys = async (kid = 'synsk-me-test-key'): Promise<AccessTestKeys> => {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
  const meta = { kid, alg: 'RS256', use: 'sig' };
  return {
    privateJwk: { ...(await exportJWK(privateKey)), ...meta },
    publicJwk: { ...(await exportJWK(publicKey)), ...meta },
  };
};

export type AccessCertsServer = {
  /** `ACCESS_ISSUER` に渡す値。`<issuer>/cdn-cgi/access/certs` が公開鍵を返す */
  issuer: string;
  close: () => Promise<void>;
};

/**
 * 公開鍵を `/cdn-cgi/access/certs` で配るサーバを 127.0.0.1 で起動する。
 * `port` を省くと空いているポートを使う
 */
export const startAccessCertsServer = async (
  publicJwk: JWK,
  { port = 0 }: { port?: number } = {},
): Promise<AccessCertsServer> => {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === ACCESS_CERTS_PATH) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const { port: boundPort } = server.address() as AddressInfo;
  return {
    issuer: `http://127.0.0.1:${boundPort}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
};

export type AccessJwtClaims = {
  issuer: string;
  audience?: string;
  email?: string;
  /** 期限。秒で表す UNIX 時刻。省くと1時間後 */
  expiresAt?: number;
};

/** Access が `Cf-Access-Jwt-Assertion` に入れる形の JWT を作る。既定は作り手のもの */
export const signAccessJwt = async (
  privateJwk: JWK,
  {
    issuer,
    audience = TEST_ACCESS_AUD,
    email = TEST_OWNER_EMAIL,
    expiresAt = Math.floor(Date.now() / 1000) + 60 * 60,
  }: AccessJwtClaims,
): Promise<string> => {
  const key = await importJWK(privateJwk, 'RS256');
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'RS256', kid: privateJwk.kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setNotBefore('0s')
    .setExpirationTime(expiresAt)
    .sign(key);
};
