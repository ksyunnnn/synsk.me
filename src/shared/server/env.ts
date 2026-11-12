import 'server-only';

/**
 * Worker の binding と secret を読む。`cloudflare:workers` の env を使うのはこのファイルだけ
 * （constitution の VIII. Portable Core）。
 *
 * `cloudflare:workers` は、使うときに読み込む。`vinext build` は動的セグメントのページの
 * モジュールを Node で読み込み、`generateStaticParams` を探す
 * （`vinext/dist/build/prerender.js` の `prerenderApp`）。モジュールの先頭で読み込むと、
 * Node が `cloudflare:` の URL を読めずにビルドが落ちる
 */

/**
 * Access の JWT の検証の設定値。Worker の secret に置く。`wrangler.jsonc` に書かないため、
 * `wrangler types` が生成する型に現れない。値の雛形は `.dev.vars.example` にある
 */
export type AccessEnv = {
  ACCESS_ISSUER?: string;
  ACCESS_AUD?: string;
  ACCESS_OWNER_EMAIL?: string;
};

/**
 * 職務経歴書のプロフィールのメールアドレス（specs/002-resume/research.md の R10）。コードに書かず、
 * Worker の secret に置く。欠ければ職務経歴書にメールアドレスを出さない。値の雛形は `.dev.vars.example` にある
 */
type ResumeEnv = {
  RESUME_EMAIL?: string;
};

/**
 * 外部の取得元の認証情報（specs/004-external-activity/research.md の R15）。Worker の secret に置き、
 * 保管するデータに持たない。GitHub と Qiita は欠ければ未認証で取る。connpass は欠ければ要求を
 * 出さない。値の雛形は `.dev.vars.example` にある
 */
export type SourceCredentialEnv = {
  GITHUB_TOKEN?: string;
  QIITA_ACCESS_TOKEN?: string;
  CONNPASS_API_KEY?: string;
};

export type Env = Cloudflare.Env & AccessEnv & ResumeEnv & SourceCredentialEnv;

export const readEnv = async (): Promise<Env> => (await import('cloudflare:workers')).env as Env;
