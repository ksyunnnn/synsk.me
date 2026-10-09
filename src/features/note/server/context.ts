import 'server-only';

import { headers } from 'next/headers';
import type { NoteRepository } from '@/features/note/domain/note-repository';
import { verifyAuthor, type Author } from '@/features/note/server/author';
import { createD1NoteRepository } from '@/features/note/server/d1-note-repository';

/**
 * 要求ごとに使うものを作る。組み立て用の関数（`queries.ts`）と Server Action
 * （`actions.ts`）の両方が使う（ADR-0030）。
 *
 * `cloudflare:workers` は、使うときに読み込む。`vinext build` は動的セグメントの
 * ページ（`/notes/[slug]` など）のモジュールを Node で読み込み、`generateStaticParams`
 * を探す（`vinext/dist/build/prerender.js` の `prerenderApp`）。モジュールの先頭で
 * 読み込むと、Node が `cloudflare:` の URL を読めずにビルドが落ちる
 */
const readEnv = async () => (await import('cloudflare:workers')).env;

/**
 * JWT の検証の設定値。Worker の secret に置く。`wrangler.jsonc` に書かないため、
 * `wrangler types` が生成する型に現れない
 */
type AccessEnv = {
  ACCESS_ISSUER?: string;
  ACCESS_AUD?: string;
  ACCESS_OWNER_EMAIL?: string;
};

/** Cloudflare Access が JWT を入れるヘッダ */
const ACCESS_JWT_HEADER = 'cf-access-jwt-assertion';

/** この要求を送ったのが作り手なら `Author` を、確かめられなければ null を返す */
export const getCurrentAuthor = async (): Promise<Author | null> => {
  const { ACCESS_ISSUER, ACCESS_AUD, ACCESS_OWNER_EMAIL } = (await readEnv()) as AccessEnv;
  return verifyAuthor((await headers()).get(ACCESS_JWT_HEADER), {
    certsUrl: ACCESS_ISSUER ? `${ACCESS_ISSUER}/cdn-cgi/access/certs` : undefined,
    issuer: ACCESS_ISSUER,
    audience: ACCESS_AUD,
    ownerEmail: ACCESS_OWNER_EMAIL,
  });
};

export const createNoteRepository = async (): Promise<NoteRepository> =>
  createD1NoteRepository((await readEnv()).DB);
