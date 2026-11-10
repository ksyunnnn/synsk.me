import { describe, expect, it, vi } from 'vitest';
import { deleteExternalActivity } from '@/features/activity/application/delete-external-activity';
import { editExternalActivity } from '@/features/activity/application/edit-external-activity';
import {
  registerExternalActivity,
  type FetchByUrl,
} from '@/features/activity/application/register-external-activity';
import type {
  ExternalActivity,
  ExternalActivityFormValues,
} from '@/features/activity/domain/external-activity';
import type { CalendarDate } from '@/shared/domain/period';
import type { Author } from '@/shared/domain/author';
import { createFakeExternalActivityRepository } from '../support/activity-fakes';

/**
 * URL を指名した・手で入力した外部の activity の登録・編集・削除（specs/004-external-activity/spec.md
 * の FR-005・FR-009〜FR-011・FR-022・FR-031・FR-033、plan.md の U11・U12、contracts/dash.md）。
 * 値はすべて作り物で、外へ要求を出さない
 */

const AUTHOR: Author = { email: 'owner@synsk.test' };
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=fakeVideo01';

const values = (overrides: Partial<ExternalActivityFormValues>): ExternalActivityFormValues => ({
  source: '',
  url: '',
  title: '',
  publishedOn: '',
  ...overrides,
});

const fetchReturning = (item: Awaited<ReturnType<FetchByUrl>>) =>
  vi.fn<FetchByUrl>(async () => item);

describe('registerExternalActivity', () => {
  it('URL を指名する取得元は、取得元の題と画像に、入れた日付の UTC の 00:00 を公開日にして保存する（FR-009・U12）', async () => {
    const { repository, rows } = createFakeExternalActivityRepository();
    const fetchByUrl = fetchReturning({
      url: YOUTUBE_URL,
      title: '作り物の動画',
      imageUrl: 'https://i.ytimg.com/fake.jpg',
    });

    const outcome = await registerExternalActivity(
      repository,
      fetchByUrl,
      AUTHOR,
      values({ source: 'youtube', url: 'https://youtu.be/fakeVideo01', publishedOn: '2024-03-01' }),
    );

    expect(outcome.status).toBe('registered');
    expect(fetchByUrl).toHaveBeenCalledWith('youtube', 'https://youtu.be/fakeVideo01');
    expect([...rows.values()]).toEqual([
      expect.objectContaining({
        source: 'youtube',
        url: YOUTUBE_URL,
        title: '作り物の動画',
        publishedOn: '2024-03-01',
        imageUrl: 'https://i.ytimg.com/fake.jpg',
      }),
    ]);
  });

  it('保存する公開日は入れた日付の UTC の 00:00（U12 の (a)）', async () => {
    const { repository } = createFakeExternalActivityRepository();
    const register = vi.spyOn(repository, 'register');

    await registerExternalActivity(
      repository,
      fetchReturning(null),
      AUTHOR,
      values({
        source: 'codepen',
        url: 'https://codepen.io/fake/pen/abc',
        title: '作り物のペン',
        publishedOn: '2020-04-01',
      }),
    );

    expect(register).toHaveBeenCalledWith('codepen', {
      url: 'https://codepen.io/fake/pen/abc',
      title: '作り物のペン',
      publishedAt: '2020-04-01T00:00:00.000Z',
      imageUrl: null,
    });
  });

  it('日付が無ければ保存せず、外へ要求を出さない（FR-011）', async () => {
    const { repository, rows } = createFakeExternalActivityRepository();
    const fetchByUrl = fetchReturning({ url: YOUTUBE_URL, title: '作り物の動画' });

    const outcome = await registerExternalActivity(
      repository,
      fetchByUrl,
      AUTHOR,
      values({ source: 'youtube', url: YOUTUBE_URL }),
    );

    expect(outcome).toMatchObject({ status: 'invalid', errors: { publishedOn: 'missing' } });
    expect(fetchByUrl).not.toHaveBeenCalled();
    expect(rows.size).toBe(0);
  });

  it('取得元のホストでない URL は、外へ要求を出さずに拒む（R10）', async () => {
    const { repository } = createFakeExternalActivityRepository();
    const fetchByUrl = fetchReturning(null);

    const outcome = await registerExternalActivity(
      repository,
      fetchByUrl,
      AUTHOR,
      values({ source: 'spotify', url: 'https://example.com/fake', publishedOn: '2024-03-01' }),
    );

    expect(outcome).toMatchObject({ status: 'invalid', errors: { url: 'wrong-host' } });
    expect(fetchByUrl).not.toHaveBeenCalled();
  });

  it.each(['zenn', 'life_event', 'unknown'])(
    '一覧を取る取得元・life event・無い取得元（%s）への登録を拒む（FR-022）',
    async (source) => {
      const { repository, rows } = createFakeExternalActivityRepository();

      const outcome = await registerExternalActivity(
        repository,
        fetchReturning(null),
        AUTHOR,
        values({ source, url: 'https://zenn.dev/fake', title: '題', publishedOn: '2024-03-01' }),
      );

      expect(outcome).toMatchObject({ status: 'invalid', errors: { source: 'invalid' } });
      expect(rows.size).toBe(0);
    },
  );

  it('題を返さない取得元（X）は、オーナーが入れた題で保存する（U11 の (a)）', async () => {
    const { repository, rows } = createFakeExternalActivityRepository();
    const url = 'https://x.com/fake_user/status/1';

    const outcome = await registerExternalActivity(
      repository,
      fetchReturning({ url }),
      AUTHOR,
      values({ source: 'x', url, title: '作り物の投稿の題', publishedOn: '2024-03-01' }),
    );

    expect(outcome.status).toBe('registered');
    expect([...rows.values()][0]).toMatchObject({ source: 'x', title: '作り物の投稿の題' });
  });

  it('題を取れず、題も入れていなければ拒む（U11 の (a)）', async () => {
    const { repository, rows } = createFakeExternalActivityRepository();

    const outcome = await registerExternalActivity(
      repository,
      fetchReturning(null),
      AUTHOR,
      values({
        source: 'codesandbox',
        url: 'https://codesandbox.io/s/fake',
        publishedOn: '2024-03-01',
      }),
    );

    expect(outcome).toMatchObject({ status: 'invalid', errors: { title: 'title-unavailable' } });
    expect(rows.size).toBe(0);
  });

  it('取得元の不調は保存せずに知らせる', async () => {
    const { repository, rows } = createFakeExternalActivityRepository();

    const outcome = await registerExternalActivity(
      repository,
      vi.fn<FetchByUrl>(async () => {
        throw new Error('作り物の不調');
      }),
      AUTHOR,
      values({ source: 'youtube', url: YOUTUBE_URL, title: '題', publishedOn: '2024-03-01' }),
    );

    expect(outcome).toMatchObject({ status: 'invalid', errors: { url: 'fetch-failed' } });
    expect(rows.size).toBe(0);
  });

  it('手で入力する取得元（CodePen）は題が必須で、外へ要求を出さない（FR-010）', async () => {
    const { repository } = createFakeExternalActivityRepository();
    const fetchByUrl = fetchReturning(null);

    const outcome = await registerExternalActivity(
      repository,
      fetchByUrl,
      AUTHOR,
      values({
        source: 'codepen',
        url: 'https://codepen.io/fake/pen/abc',
        publishedOn: '2024-03-01',
      }),
    );

    expect(outcome).toMatchObject({ status: 'invalid', errors: { title: 'missing' } });
    expect(fetchByUrl).not.toHaveBeenCalled();
  });

  it('登録していないサイトは、揃えた URL が同じなら拒む（FR-005）', async () => {
    const { repository, rows } = createFakeExternalActivityRepository();
    const register = (url: string) =>
      registerExternalActivity(
        repository,
        fetchReturning(null),
        AUTHOR,
        values({ source: 'unlisted', url, title: '作り物の記事', publishedOn: '2024-03-01' }),
      );

    expect((await register('https://Example.com/fake#top')).status).toBe('registered');
    expect(await register('https://example.com/fake')).toMatchObject({
      status: 'invalid',
      errors: { url: 'url-taken' },
    });
    expect([...rows.values()].map((row) => row.url)).toEqual(['https://example.com/fake']);
  });

  it('オーナーでなければ何も書かず、外へ要求を出さない（FR-031）', async () => {
    const { repository, rows } = createFakeExternalActivityRepository();
    const fetchByUrl = fetchReturning({ url: YOUTUBE_URL, title: '作り物の動画' });

    const outcome = await registerExternalActivity(
      repository,
      fetchByUrl,
      null,
      values({ source: 'youtube', url: YOUTUBE_URL, publishedOn: '2024-03-01' }),
    );

    expect(outcome).toEqual({ status: 'forbidden' });
    expect(fetchByUrl).not.toHaveBeenCalled();
    expect(rows.size).toBe(0);
  });
});

const stored = (overrides: Partial<ExternalActivity>): ExternalActivity => ({
  id: 1,
  uid: '1'.repeat(32),
  source: 'youtube',
  url: YOUTUBE_URL,
  title: '作り物の動画',
  publishedOn: '2024-03-01' as CalendarDate,
  ...overrides,
});

describe('editExternalActivity', () => {
  it('URL を指名する取得元は日付だけを書き換え、送られた URL と題を読まない', async () => {
    const { repository, rows } = createFakeExternalActivityRepository([stored({})]);

    const outcome = await editExternalActivity(
      repository,
      AUTHOR,
      1,
      values({ url: 'https://example.com/other', title: '別の題', publishedOn: '2024-05-05' }),
    );

    expect(outcome).toEqual({ status: 'saved' });
    expect(rows.get(1)).toMatchObject({
      url: YOUTUBE_URL,
      title: '作り物の動画',
      publishedOn: '2024-05-05',
    });
  });

  it('手で入力する取得元は URL と題も書き換える', async () => {
    const { repository, rows } = createFakeExternalActivityRepository([
      stored({ source: 'codepen', url: 'https://codepen.io/fake/pen/a', title: '前の題' }),
    ]);

    const outcome = await editExternalActivity(
      repository,
      AUTHOR,
      1,
      values({
        url: 'https://codepen.io/fake/pen/b',
        title: '新しい題',
        publishedOn: '2024-05-05',
      }),
    );

    expect(outcome).toEqual({ status: 'saved' });
    expect(rows.get(1)).toMatchObject({
      source: 'codepen',
      url: 'https://codepen.io/fake/pen/b',
      title: '新しい題',
    });
  });

  it('日付が無ければ書き換えない', async () => {
    const { repository, rows } = createFakeExternalActivityRepository([stored({})]);

    const outcome = await editExternalActivity(repository, AUTHOR, 1, values({}));

    expect(outcome).toMatchObject({ status: 'invalid', errors: { publishedOn: 'missing' } });
    expect(rows.get(1)?.publishedOn).toBe('2024-03-01');
  });

  it('無い行は not-found（一覧を取る取得元の行は Repository が見つけない。FR-022）', async () => {
    const { repository } = createFakeExternalActivityRepository();

    expect(
      await editExternalActivity(repository, AUTHOR, 9, values({ publishedOn: '2024-05-05' })),
    ).toEqual({ status: 'not-found' });
  });

  it('オーナーでなければ何も書かない（FR-031）', async () => {
    const { repository, rows } = createFakeExternalActivityRepository([stored({})]);

    expect(
      await editExternalActivity(repository, null, 1, values({ publishedOn: '2024-05-05' })),
    ).toEqual({ status: 'forbidden' });
    expect(rows.get(1)?.publishedOn).toBe('2024-03-01');
  });
});

describe('deleteExternalActivity', () => {
  it('行を消す（FR-033）', async () => {
    const { repository, rows } = createFakeExternalActivityRepository([stored({})]);

    expect(await deleteExternalActivity(repository, AUTHOR, 1)).toEqual({ status: 'deleted' });
    expect(rows.size).toBe(0);
  });

  it('無い行は not-found', async () => {
    const { repository } = createFakeExternalActivityRepository();

    expect(await deleteExternalActivity(repository, AUTHOR, 1)).toEqual({ status: 'not-found' });
  });

  it('オーナーでなければ何も消さない（FR-031）', async () => {
    const { repository, rows } = createFakeExternalActivityRepository([stored({})]);

    expect(await deleteExternalActivity(repository, null, 1)).toEqual({ status: 'forbidden' });
    expect(rows.size).toBe(1);
  });
});
