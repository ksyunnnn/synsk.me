import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `npm run dev` でだけ作り手の判定を飛ばす分岐（src/shared/server/author.ts）が、build した
 * dist/ に残っていないことを確かめる。分岐は `import.meta.env.DEV` で分け、Vite が build のときに
 * 定数へ置き換えて消す。分岐の中の固定のメールアドレスを、分岐が残った印として探す。
 *
 * ソースマップ（`.map`）は元のソースの文字列を持つため除く。実行されるのは `.map` 以外である。
 * JWT のない `/dash` が build したものの上で 403 になることは private-responses.test.ts が持つ
 */

const DIST = 'dist';
const SOURCE = 'src/shared/server/author.ts';
/** 分岐の中にだけある値 */
const MARK = 'dev-author@localhost.invalid';
/** 作り手の判定の、build に残る側にある値。探す先が正しいことを確かめる対照に使う */
const KEPT = 'cf-access-jwt-assertion';

const readBuiltFiles = async () => {
  const entries = await readdir(DIST, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && !entry.name.endsWith('.map'))
    .map((entry) => join(entry.parentPath, entry.name));
  return Promise.all(files.map(async (path) => ({ path, text: await readFile(path, 'utf8') })));
};

describe('build に作り手の判定を飛ばす分岐が無い', () => {
  it('対照: ソースは分岐の印を持つ', async () => {
    expect(await readFile(SOURCE, 'utf8')).toContain(MARK);
  });

  it('対照: build したものは作り手の判定を持つ', async () => {
    const files = await readBuiltFiles();
    expect(files.some(({ text }) => text.includes(KEPT))).toBe(true);
  });

  it('build したもののどのファイルにも、分岐の印が無い', async () => {
    const files = await readBuiltFiles();
    expect(files.filter(({ text }) => text.includes(MARK)).map(({ path }) => path)).toEqual([]);
  });
});
